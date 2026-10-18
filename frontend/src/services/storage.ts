import type { Quiz, User } from '../types/quiz';
import * as api from './api';
import { authApi, quizApi } from './api';

const STORAGE_QUIZZES_KEY = 'quizwave_quizzes_v2';
const STORAGE_USER_KEY = 'quizwave_host_user_v1';

// Starter quizzes showcasing image & audio features
const SAMPLE_QUIZZES: Quiz[] = [
  {
    id: 'quiz-multimedia-master',
    hostId: 'host-demo',
    title: '🎵 Global Sounds & Famous Landmarks',
    description: 'An interactive quiz featuring multimedia questions with audio notes and vivid images!',
    basePoints: 1000,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    questions: [
      {
        id: 'q1-taj',
        quizId: 'quiz-multimedia-master',
        orderIndex: 0,
        prompt: 'In which city is this magnificent ivory-white marble mausoleum located?',
        imageUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
        audioUrl: '',
        timeLimitSec: 20,
        options: [
          { id: 'opt1', text: 'Jaipur, Rajasthan', isCorrect: false },
          { id: 'opt2', text: 'Agra, Uttar Pradesh', isCorrect: true },
          { id: 'opt3', text: 'New Delhi', isCorrect: false },
          { id: 'opt4', text: 'Lucknow, Uttar Pradesh', isCorrect: false },
        ],
      },
      {
        id: 'q2-video-earth',
        quizId: 'quiz-multimedia-master',
        orderIndex: 1,
        prompt: 'Watch this stunning satellite video footage! What atmospheric phenomenon is visible orbiting our planet?',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        audioUrl: '', // Host can put video with or without separate audio
        timeLimitSec: 25,
        options: [
          { id: 'opt-v1', text: 'Solar Flare Reaction', isCorrect: true },
          { id: 'opt-v2', text: 'Total Lunar Eclipse', isCorrect: false },
          { id: 'opt-v3', text: 'Geomagnetic Storm', isCorrect: false },
          { id: 'opt-v4', text: 'Asteroid Collision', isCorrect: false },
        ],
      },
      {
        id: 'q3-option-images-art',
        quizId: 'quiz-multimedia-master',
        orderIndex: 2,
        prompt: 'Visual Art Challenge: Which of these famous masterpieces was painted by Vincent van Gogh in 1889?',
        imageUrl: '',
        audioUrl: '',
        timeLimitSec: 25,
        options: [
          {
            id: 'art-1',
            text: 'The Starry Night',
            imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
            isCorrect: true,
          },
          {
            id: 'art-2',
            text: 'Mona Lisa',
            imageUrl: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=600&q=80',
            isCorrect: false,
          },
          {
            id: 'art-3',
            text: 'Girl with a Pearl Earring',
            imageUrl: 'https://images.unsplash.com/photo-1582561424760-0321d75e81fa?auto=format&fit=crop&w=600&q=80',
            isCorrect: false,
          },
          {
            id: 'art-4',
            text: 'The Kiss',
            imageUrl: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=600&q=80',
            isCorrect: false,
          },
        ],
      },
      {
        id: 'q4-audio-bird',
        quizId: 'quiz-multimedia-master',
        orderIndex: 3,
        prompt: 'Listen closely to the audio clip! Which nocturnal bird produces this characteristic call?',
        imageUrl: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?auto=format&fit=crop&w=1200&q=80',
        audioUrl: 'https://cdn.freesound.org/previews/659/659610_11861866-lq.mp3',
        timeLimitSec: 25,
        options: [
          { id: 'opt2-1', text: 'Great Horned Owl', isCorrect: true },
          { id: 'opt2-2', text: 'American Crow', isCorrect: false },
          { id: 'opt2-3', text: 'Peregrine Falcon', isCorrect: false },
          { id: 'opt2-4', text: 'Blue Jay', isCorrect: false },
        ],
      },
      {
        id: 'q5-space',
        quizId: 'quiz-multimedia-master',
        orderIndex: 4,
        prompt: 'Which planet in our solar system is nicknamed the "Red Planet" due to iron oxide on its surface?',
        imageUrl: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80',
        audioUrl: '',
        timeLimitSec: 15,
        options: [
          { id: 'opt3-1', text: 'Venus', isCorrect: false },
          { id: 'opt3-2', text: 'Jupiter', isCorrect: false },
          { id: 'opt3-3', text: 'Mars', isCorrect: true },
          { id: 'opt3-4', text: 'Mercury', isCorrect: false },
        ],
      },
    ],
  },
  {
    id: 'quiz-tech-trivia',
    hostId: 'host-demo',
    title: '💻 Web & Computer Science Lightning Round',
    description: 'Fast-paced quiz on programming languages, internet protocols, and software design.',
    basePoints: 1000,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
    questions: [
      {
        id: 'qt-1',
        quizId: 'quiz-tech-trivia',
        orderIndex: 0,
        prompt: 'Which protocol powers real-time full-duplex communication over a single TCP connection?',
        imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
        timeLimitSec: 15,
        options: [
          { id: 'opt-t1', text: 'HTTP/1.1 Polling', isCorrect: false },
          { id: 'opt-t2', text: 'WebSocket (WSS)', isCorrect: true },
          { id: 'opt-t3', text: 'FTP Passive Mode', isCorrect: false },
          { id: 'opt-t4', text: 'DNS over UDP', isCorrect: false },
        ],
      },
      {
        id: 'qt-2',
        quizId: 'quiz-tech-trivia',
        orderIndex: 1,
        prompt: 'What data structure in Redis is optimal for maintaining a live ranked leaderboard in O(log N)?',
        imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
        timeLimitSec: 20,
        options: [
          { id: 'opt-t2-1', text: 'Redis Hashes (HSET)', isCorrect: false },
          { id: 'opt-t2-2', text: 'Redis Sorted Sets (ZSET)', isCorrect: true },
          { id: 'opt-t2-3', text: 'Redis Lists (LPUSH)', isCorrect: false },
          { id: 'opt-t2-4', text: 'Redis Bitmaps', isCorrect: false },
        ],
      },
      {
        id: 'qt-3',
        quizId: 'quiz-tech-trivia',
        orderIndex: 2,
        prompt: 'Who created the World Wide Web and the first web browser in 1989 at CERN?',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
        timeLimitSec: 15,
        options: [
          { id: 'opt-t3-1', text: 'Tim Berners-Lee', isCorrect: true },
          { id: 'opt-t3-2', text: 'Linus Torvalds', isCorrect: false },
          { id: 'opt-t3-3', text: 'Alan Turing', isCorrect: false },
          { id: 'opt-t3-4', text: 'Grace Hopper', isCorrect: false },
        ],
      },
    ],
  },
];

function writeLocalQuizzes(list: Quiz[]) {
  localStorage.setItem(STORAGE_QUIZZES_KEY, JSON.stringify(list));
}

function readLocalQuizzes(): Quiz[] {
  const raw = localStorage.getItem(STORAGE_QUIZZES_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_QUIZZES_KEY, JSON.stringify(SAMPLE_QUIZZES));
    return SAMPLE_QUIZZES;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return SAMPLE_QUIZZES;
  }
}

export const storageService = {
  // ------------------------------------------------------------------
  // Synchronous cache accessors (local engine + split-screen demo)
  // ------------------------------------------------------------------
  getCachedQuizzes(): Quiz[] {
    return readLocalQuizzes();
  },

  getCachedQuizById(id: string): Quiz | null {
    return readLocalQuizzes().find((q) => q.id === id) || null;
  },

  // ------------------------------------------------------------------
  // Quizzes CRUD — backend REST when reachable, localStorage otherwise
  // ------------------------------------------------------------------
  async getQuizzes(): Promise<Quiz[]> {
    if (await api.isRemote()) {
      try {
        let { quizzes } = await quizApi.list();
        if (quizzes.length === 0) {
          quizzes = await storageService.seedSampleQuizzes();
        }
        writeLocalQuizzes(quizzes);
        return quizzes;
      } catch (err) {
        console.warn('[storage] remote list failed, using cache', err);
      }
    }
    return readLocalQuizzes();
  },

  /** Creates the showcase quizzes on the backend the first time it runs. */
  async seedSampleQuizzes(): Promise<Quiz[]> {
    const created: Quiz[] = [];
    for (const sample of SAMPLE_QUIZZES) {
      try {
        const { quiz } = await quizApi.create({
          title: sample.title,
          description: sample.description,
          basePoints: sample.basePoints,
          questions: sample.questions.map((q) => ({
            prompt: q.prompt,
            imageUrl: q.imageUrl,
            videoUrl: q.videoUrl,
            audioUrl: q.audioUrl,
            timeLimitSec: q.timeLimitSec,
            options: q.options.map((o) => ({
              text: o.text,
              imageUrl: o.imageUrl,
              videoUrl: o.videoUrl,
              isCorrect: o.isCorrect,
            })),
          })),
        });
        created.push(quiz);
      } catch (err) {
        console.warn('[storage] seed failed for sample quiz', err);
      }
    }
    return created;
  },

  async getQuizById(id: string): Promise<Quiz | null> {
    if (await api.isRemote()) {
      try {
        const { quiz } = await quizApi.get(id);
        return quiz;
      } catch {
        return storageService.getCachedQuizById(id);
      }
    }
    return storageService.getCachedQuizById(id);
  },

  async saveQuiz(quiz: Quiz): Promise<Quiz> {
    if (await api.isRemote()) {
      const payload = {
        title: quiz.title,
        description: quiz.description,
        basePoints: quiz.basePoints,
        questions: quiz.questions.map((q) => ({
          prompt: q.prompt,
          imageUrl: q.imageUrl,
          videoUrl: q.videoUrl,
          audioUrl: q.audioUrl,
          timeLimitSec: q.timeLimitSec,
          options: q.options.map((o) => ({
            text: o.text,
            imageUrl: o.imageUrl,
            videoUrl: o.videoUrl,
            isCorrect: o.isCorrect,
          })),
        })),
      };
      try {
        await quizApi.get(quiz.id);
        const { quiz: updated } = await quizApi.update(quiz.id, payload);
        const list = readLocalQuizzes().map((q) => (q.id === updated.id ? updated : q));
        writeLocalQuizzes(list);
        return updated;
      } catch {
        const { quiz: created } = await quizApi.create(payload);
        const list = readLocalQuizzes();
        writeLocalQuizzes([created, ...list]);
        return created;
      }
    }

    const list = readLocalQuizzes();
    const index = list.findIndex((q) => q.id === quiz.id);
    if (index >= 0) {
      list[index] = { ...quiz, updatedAt: Date.now() };
    } else {
      list.unshift({ ...quiz, createdAt: Date.now(), updatedAt: Date.now() });
    }
    writeLocalQuizzes(list);
    return quiz;
  },

  async deleteQuiz(id: string): Promise<void> {
    if (await api.isRemote()) {
      try {
        await quizApi.remove(id);
      } catch (err) {
        console.warn('[storage] remote delete failed', err);
      }
    }
    writeLocalQuizzes(readLocalQuizzes().filter((q) => q.id !== id));
  },

  async duplicateQuiz(id: string): Promise<Quiz | null> {
    if (await api.isRemote()) {
      try {
        const { quiz } = await quizApi.duplicate(id);
        writeLocalQuizzes([quiz, ...readLocalQuizzes()]);
        return quiz;
      } catch {
        return null;
      }
    }

    const quiz = storageService.getCachedQuizById(id);
    if (!quiz) return null;
    const copy: Quiz = {
      ...quiz,
      id: 'quiz-' + Math.random().toString(36).substring(2, 9),
      title: `${quiz.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      questions: quiz.questions.map((q) => ({
        ...q,
        id: 'q-' + Math.random().toString(36).substring(2, 9),
        options: q.options.map((opt) => ({
          ...opt,
          id: 'opt-' + Math.random().toString(36).substring(2, 9),
        })),
      })),
    };
    const list = readLocalQuizzes();
    list.unshift(copy);
    writeLocalQuizzes(list);
    return copy;
  },

  // ------------------------------------------------------------------
  // Host Auth State (JWT on backend, cached profile in localStorage)
  // ------------------------------------------------------------------
  getCurrentUser(): User | null {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async loginHost(email: string, name: string): Promise<User> {
    if (await api.isRemote()) {
      try {
        const { token, user } = await authApi.register(
          email,
          Math.random().toString(36).slice(2, 10),
          name
        );
        api.setHostToken(token);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        return user;
      } catch {
        // fall through to demo-style local user
      }
    }
    const user: User = {
      id: 'host-' + Math.random().toString(36).substring(2, 8),
      email,
      name: name || email.split('@')[0],
      role: 'host',
    };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    return user;
  },

  /** FR-A1: 1-click demo host — authenticates against the backend when up. */
  async quickDemoLogin(): Promise<User> {
    if (await api.isRemote()) {
      try {
        const { token, user } = await authApi.demoLogin();
        api.setHostToken(token);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        return user;
      } catch (err) {
        console.warn('[storage] remote demo login failed, using local session', err);
      }
    }
    const demoUser: User = {
      id: 'host-demo-1',
      email: 'host@quizwave.live',
      name: 'Professor Alex',
      role: 'host',
    };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(demoUser));
    return demoUser;
  },

  logout(): void {
    localStorage.removeItem(STORAGE_USER_KEY);
    api.setHostToken(null);
    api.setStudentToken(null);
  },
};
