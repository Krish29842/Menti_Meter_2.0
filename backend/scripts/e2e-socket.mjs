/**
 * Full-stack e2e test: REST + Socket.io, host privacy, scoring, anti-cheat.
 * Run with backend + (optionally) frontend running: node scripts/e2e-socket.mjs
 */
import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch { /* empty */ }
  return { status: res.status, data };
}

function connect(token) {
  return io(BASE, { auth: { token }, transports: ['websocket'] });
}

function waitFor(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout for ${event}`)), timeoutMs);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      if (res?.ok) resolve(res.data);
      else reject(new Error(res?.error || 'ack failed'));
    });
  });
}

async function main() {
  console.log(`E2E socket test → ${BASE}\n`);

  // Setup: host + quiz via REST
  const demo = await api('POST', '/auth/demo');
  const hostToken = demo.data.token;
  const quizRes = await api('POST', '/quizzes', {
    token: hostToken,
    body: {
      title: 'E2E Socket Quiz',
      basePoints: 1000,
      questions: [
        {
          prompt: 'Secret prompt that hosts must not see live',
          timeLimitSec: 10,
          options: [
            { text: 'Alpha', isCorrect: true },
            { text: 'Beta', isCorrect: false },
            { text: 'Gamma', isCorrect: false },
          ],
        },
      ],
    },
  });
  const quiz = quizRes.data.quiz;

  // --- Host socket: create + bind session
  const host = connect(hostToken);
  await waitFor(host, 'connect');
  check('host socket connected', host.connected);

  const { session } = await emitAck(host, 'session:create', { quizId: quiz.id });
  check('session created via WS with PIN', /^\d{3}-\d{3}$/.test(session.code));

  // --- Student socket: join via WS (register host waiter BEFORE joining)
  const student = connect(null);
  await waitFor(student, 'connect');
  const joinedPromise = waitFor(host, 'student:joined');
  const joinData = await emitAck(student, 'session:join', {
    code: session.code,
    displayName: 'WS Student',
    avatar: '🐼',
  });
  check('student joined via WS', Boolean(joinData.token && joinData.participant.id));

  // Host sees the join
  const joinedEvt = await joinedPromise;
  check(
    'host notified of student:joined',
    joinedEvt.participant.displayName === 'WS Student' &&
      joinedEvt.connectedStudentsCount === 1
  );

  // Reconnect student socket with its token (fresh tab simulation)
  student.disconnect();
  const student2 = connect(joinData.token);
  await waitFor(student2, 'connect');
  await emitAck(student2, 'session:bind-student', { sessionId: session.id });

  // --- Host starts the quiz
  const studentOpenPromise = waitFor(student2, 'question:open');
  const hostOpenPromise = waitFor(host, 'question:open');
  await emitAck(host, 'session:start', { sessionId: session.id });

  const studentOpen = await studentOpenPromise;
  const hostOpen = await hostOpenPromise;

  check('student receives question content', Boolean(studentOpen.studentDTO?.prompt));
  check(
    'student payload has NO answer keys',
    !JSON.stringify(studentOpen.studentDTO).includes('isCorrect')
  );
  check('host receives stripped hostDTO', Boolean(hostOpen.hostDTO && !hostOpen.studentDTO));
  check(
    'host payload leaks NO prompt (FR-H3S)',
    !JSON.stringify(hostOpen).includes('Secret prompt')
  );

  const questionId = studentOpen.studentDTO.questionId;
  const correctOptionId = studentOpen.studentDTO.options[0].id;

  // --- Student answers via WS
  const boardPromise = waitFor(host, 'leaderboard:update');
  const answerAck = await emitAck(student2, 'answer:submit', {
    sessionId: session.id,
    questionId,
    optionId: correctOptionId,
  });
  check('answer accepted', answerAck.result.answered === true);
  check('correct answer scored >0', answerAck.result.pointsEarned > 0);
  check('student rank 1', answerAck.result.rank === 1);

  const board = await boardPromise;
  check(
    'host leaderboard updated',
    board.leaderboard?.[0]?.displayName === 'WS Student' && board.answeredCount === 1
  );

  // Duplicate answer rejected
  let dupRejected = false;
  try {
    await emitAck(student2, 'answer:submit', {
      sessionId: session.id,
      questionId,
      optionId: correctOptionId,
    });
  } catch (err) {
    dupRejected = /already answered/i.test(err.message);
  }
  check('duplicate answer rejected', dupRejected);

  // --- Host closes round
  const studentClosedPromise = waitFor(student2, 'question:closed');
  const hostClosedPromise = waitFor(host, 'question:closed');
  await emitAck(host, 'question:close', { sessionId: session.id });

  const studentClosed = await studentClosedPromise;
  const hostClosed = await hostClosedPromise;
  check(
    'student receives correctOptionId + result',
    studentClosed.correctOptionId === correctOptionId &&
      studentClosed.yourResult?.isCorrect === true
  );
  check(
    'host round summary (no option texts)',
    hostClosed.roundSummary?.correctCount === 1 &&
      !JSON.stringify(hostClosed).includes('Secret prompt')
  );

  // --- End session
  const studentEndPromise = waitFor(student2, 'session:ended');
  const hostEndPromise = waitFor(host, 'session:ended');
  await emitAck(host, 'session:end', { sessionId: session.id });

  const hostEnd = await hostEndPromise;
  const studentEnd = await studentEndPromise;
  check(
    'host gets full quiz + results at end (FR-H4S)',
    Boolean(hostEnd.quiz?.questions) && Boolean(hostEnd.results)
  );
  check(
    'student gets lean final leaderboard (no quiz answers)',
    Array.isArray(studentEnd.finalLeaderboard) &&
      !('quiz' in studentEnd) &&
      !('results' in studentEnd)
  );
  check(
    'final leaderboard ranked #1 WS Student',
    studentEnd.finalLeaderboard[0]?.displayName === 'WS Student' &&
      studentEnd.finalLeaderboard[0]?.score > 0
  );

  host.disconnect();
  student2.disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('E2E crashed:', err.message);
  process.exit(1);
});

