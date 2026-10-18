/**
 * End-to-end smoke test for the QuizWave backend REST flow.
 * Run: npm run dev (in another terminal) then `npm run smoke`
 */
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
  } catch {
    /* 204 etc */
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // 1. Health
  const health = await api('GET', '/health').catch(() => null);
  check('health endpoint', health?.status === 200 && health.data?.ok === true);

  // 2. Demo host login (FR-A1)
  const demo = await api('POST', '/auth/demo');
  const hostToken = demo.data?.token;
  check('demo host login', demo.status === 200 && Boolean(hostToken));

  // 3. Register + duplicate register 409
  const testEmail = `smoke_${Date.now()}@test.dev`;
  const reg = await api('POST', '/auth/register', {
    body: { email: testEmail, password: 'secret123', name: 'Smoke' },
  });
  check('host register', reg.status === 201 && Boolean(reg.data?.token));
  const regDup = await api('POST', '/auth/register', {
    body: { email: testEmail, password: 'secret123' },
  });
  check('duplicate register rejected 409', regDup.status === 409);

  // 4. Create quiz with one multimedia question
  const quizRes = await api('POST', '/quizzes', {
    token: hostToken,
    body: {
      title: 'Smoke Quiz',
      description: 'automated',
      basePoints: 1000,
      questions: [
        {
          prompt: 'What is 2 + 2?',
          timeLimitSec: 20,
          options: [
            { text: '3', isCorrect: false },
            { text: '4', isCorrect: true },
            { text: '5', isCorrect: false },
          ],
        },
      ],
    },
  });
  const quiz = quizRes.data?.quiz;
  check('create quiz', quizRes.status === 201 && Boolean(quiz?.id));
  check('question hydrated with ids', Boolean(quiz?.questions?.[0]?.options?.[1]?.id));

  // 5. Validation: two correct options rejected
  const badQuiz = await api('POST', '/quizzes', {
    token: hostToken,
    body: {
      title: 'Bad',
      questions: [
        {
          prompt: 'x',
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: true },
          ],
        },
      ],
    },
  });
  check('two correct options rejected 400', badQuiz.status === 400);

  // 6. Unauthorized quiz list rejected
  const noAuth = await api('GET', '/quizzes');
  check('quiz list requires auth 401', noAuth.status === 401);

  // 7. Start session -> 6-digit code
  const sessionRes = await api('POST', '/sessions', {
    token: hostToken,
    body: { quizId: quiz.id },
  });
  const session = sessionRes.data?.session;
  check(
    'create session with 6-digit code',
    sessionRes.status === 201 && /^\d{3}-\d{3}$/.test(session?.code ?? '')
  );

  // 8. Join with bad code -> 404
  const badJoin = await api('POST', '/sessions/join', {
    body: { code: '000-000', displayName: 'Ghost' },
  });
  check('join unknown code 404', badJoin.status === 404);

  // 9. Student joins (FR-A2)
  const join = await api('POST', '/sessions/join', {
    body: { code: session.code, displayName: 'Test Student', avatar: '🚀' },
  });
  const studentToken = join.data?.token;
  check('student join', join.status === 201 && Boolean(studentToken));

  // 10. Join page preview
  const preview = await api('GET', `/sessions/code/${session.code}`);
  check(
    'join preview',
    preview.status === 200 && preview.data?.connectedStudentsCount === 1
  );

  // 11. Student cannot start session (role guard)
  const studentStart = await api('POST', `/sessions/${session.id}/start`, {
    token: studentToken,
  });
  check('student cannot start session 403', studentStart.status === 403);

  // 12. Host starts session
  const started = await api('POST', `/sessions/${session.id}/start`, {
    token: hostToken,
  });
  check('host starts session', started.status === 200);

  // 13. Student state: question present, no answer keys
  const sState = await api('GET', `/sessions/${session.id}/student`, {
    token: studentToken,
  });
  const q = sState.data?.question;
  check('student receives question', sState.status === 200 && Boolean(q?.questionId));
  check(
    'no isCorrect leaked to student',
    !JSON.stringify(q).includes('isCorrect')
  );
  check('deadline set', typeof q?.deadline === 'number');

  const questionId = q.questionId;
  const correctOptionId = q.options[1].id;
  const wrongOptionId = q.options[0].id;

  // 14. Host state is stripped (FR-H3S)
  const hState = await api('GET', `/sessions/${session.id}/state`, {
    token: hostToken,
  });
  const hostJson = JSON.stringify(hState.data);
  check('host state has leaderboard', Boolean(hState.data?.hostState?.leaderboard));
  check('host state has no question prompt', !hostJson.includes('What is 2 + 2?'));
  check('host state has no answer key', !hostJson.includes('"isCorrect"'));

  // 15. Submit wrong answer first? No — submit correct answer
  const answer = await api('POST', `/sessions/${session.id}/answer`, {
    token: studentToken,
    body: { questionId, optionId: correctOptionId },
  });
  check('submit answer', answer.status === 201);
  check(
    'correct answer scores >0 points',
    (answer.data?.result?.pointsEarned ?? 0) > 0
  );

  // 16. Duplicate answer -> 409 (anti-cheat)
  const dup = await api('POST', `/sessions/${session.id}/answer`, {
    token: studentToken,
    body: { questionId, optionId: wrongOptionId },
  });
  check('duplicate answer 409', dup.status === 409);

  // 17. Close question manually
  const closed = await api('POST', `/sessions/${session.id}/close`, {
    token: hostToken,
  });
  check('close question', closed.status === 200);

  // 18. Answer after close -> 409
  const join2 = await api('POST', '/sessions/join', {
    body: { code: session.code, displayName: 'Late Student', avatar: '🐼' },
  });
  const lateToken = join2.data?.token;
  const late = await api('POST', `/sessions/${session.id}/answer`, {
    token: lateToken,
    body: { questionId, optionId: wrongOptionId },
  });
  check('answer after close 409', late.status === 409);

  // 19. Student sees result after close (FR-S4)
  const sState2 = await api('GET', `/sessions/${session.id}/student`, {
    token: studentToken,
  });
  check(
    'student result after close',
    sState2.data?.currentResult?.isCorrect === true &&
      sState2.data?.currentResult?.rank === 1
  );

  // 20. End session + results (FR-H4S)
  const ended = await api('POST', `/sessions/${session.id}/end`, { token: hostToken });
  check('end session', ended.status === 200);
  const results = await api('GET', `/sessions/${session.id}/results`, {
    token: hostToken,
  });
  check(
    'post-session results',
    results.status === 200 &&
      results.data?.results?.perQuestion?.[0]?.correctCount === 1
  );
  check(
    'results leaderboard ranked',
    results.data?.results?.leaderboard?.[0]?.rank === 1
  );

  // 21. Join after end -> 404
  const joinEnded = await api('POST', '/sessions/join', {
    body: { code: session.code, displayName: 'Too Late' },
  });
  check('join ended session 404', joinEnded.status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  process.exit(1);
});
