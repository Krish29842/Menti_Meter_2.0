import type { Quiz, User } from '../types/quiz';

const STORAGE_QUIZZES_KEY = 'quizwave_quizzes_v1';
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
        id: 'q2-audio-bird',
        quizId: 'quiz-multimedia-master',
        orderIndex: 1,
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
        id: 'q3-space',
        quizId: 'quiz-multimedia-master',
        orderIndex: 2,
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
      {
        id: 'q4-audio-chime',
        quizId: 'quiz-multimedia-master',
        orderIndex: 3,
        prompt: 'Listen to this acoustic sound! What instrument category does this sound belong to?',
        imageUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80',
        audioUrl: 'https://cdn.freesound.org/previews/415/415209_5121236-lq.mp3',
        timeLimitSec: 20,
        options: [
          { id: 'opt4-1', text: 'Percussion / Metallic Chimes', isCorrect: true },
          { id: 'opt4-2', text: 'Brass / Trumpet', isCorrect: false },
          { id: 'opt4-3', text: 'Woodwind / Flute', isCorrect: false },
          { id: 'opt4-4', text: 'Electric Synthesizer', isCorrect: false },
        ],
      },
      {
        id: 'q5-pyramid',
        quizId: 'quiz-multimedia-master',
        orderIndex: 4,
        prompt: 'The Great Pyramid of Giza was built for which ancient Egyptian Pharaoh?',
        imageUrl: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80',
        audioUrl: '',
        timeLimitSec: 20,
        options: [
          { id: 'opt5-1', text: 'Tutankhamun', isCorrect: false },
          { id: 'opt5-2', text: 'Khufu (Cheops)', isCorrect: true },
          { id: 'opt5-3', text: 'Ramses II', isCorrect: false },
          { id: 'opt5-4', text: 'Cleopatra VII', isCorrect: false },
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

export const storageService = {
  // Quizzes CRUD
  getQuizzes(): Quiz[] {
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
  },

  getQuizById(id: string): Quiz | undefined {
    const list = this.getQuizzes();
    return list.find((q) => q.id === id);
  },

  saveQuiz(quiz: Quiz): void {
    const list = this.getQuizzes();
    const index = list.findIndex((q) => q.id === quiz.id);
    if (index >= 0) {
      list[index] = { ...quiz, updatedAt: Date.now() };
    } else {
      list.unshift({ ...quiz, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_QUIZZES_KEY, JSON.stringify(list));
  },

  deleteQuiz(id: string): void {
    const list = this.getQuizzes().filter((q) => q.id !== id);
    localStorage.setItem(STORAGE_QUIZZES_KEY, JSON.stringify(list));
  },

  duplicateQuiz(id: string): Quiz | null {
    const quiz = this.getQuizById(id);
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
    this.saveQuiz(copy);
    return copy;
  },

  // Host Auth State
  getCurrentUser(): User | null {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  loginHost(email: string, name: string): User {
    const user: User = {
      id: 'host-' + Math.random().toString(36).substring(2, 8),
      email,
      name: name || email.split('@')[0],
      role: 'host',
    };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    return user;
  },

  quickDemoLogin(): User {
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
  },
};
