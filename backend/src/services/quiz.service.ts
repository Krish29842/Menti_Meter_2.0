import { getStorage } from '../storage';
import type { AnswerOption, Question, Quiz } from '../types/domain';
import { newId } from '../utils/ids';
import type { QuestionInput, QuizInput } from '../utils/validation';

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

function hydrateQuestion(quizId: string, index: number, input: QuestionInput): Question {
  const options: AnswerOption[] = input.options.map((o) => ({
    id: o.id || newId('opt'),
    text: o.text,
    imageUrl: o.imageUrl || undefined,
    videoUrl: o.videoUrl || undefined,
    isCorrect: o.isCorrect,
  }));
  return {
    id: input.id || newId('q'),
    quizId,
    orderIndex: index,
    prompt: input.prompt,
    imageUrl: input.imageUrl || undefined,
    videoUrl: input.videoUrl || undefined,
    audioUrl: input.audioUrl || undefined,
    options,
    timeLimitSec: input.timeLimitSec ?? 20,
  };
}

class QuizService {
  async list(hostId: string): Promise<Quiz[]> {
    return getStorage().quizzes.listByHost(hostId);
  }

  async get(hostId: string, quizId: string): Promise<Quiz> {
    const quiz = await getStorage().quizzes.findById(quizId);
    if (!quiz) throw httpError(404, 'Quiz not found');
    if (quiz.hostId !== hostId) throw httpError(403, 'Not your quiz');
    return quiz;
  }

  async create(hostId: string, input: QuizInput): Promise<Quiz> {
    const now = Date.now();
    const quiz: Quiz = {
      id: newId('quiz'),
      hostId,
      title: input.title,
      description: input.description ?? '',
      basePoints: input.basePoints ?? 1000,
      questions: (input.questions ?? []).map((q, i) => hydrateQuestion('', i, q)),
      createdAt: now,
      updatedAt: now,
    };
    quiz.questions.forEach((q) => (q.quizId = quiz.id));
    return getStorage().quizzes.create(quiz);
  }

  async update(hostId: string, quizId: string, patch: Partial<QuizInput>): Promise<Quiz> {
    const quiz = await this.get(hostId, quizId);
    if (patch.title !== undefined) quiz.title = patch.title;
    if (patch.description !== undefined) quiz.description = patch.description;
    if (patch.basePoints !== undefined) quiz.basePoints = patch.basePoints;
    if (patch.questions !== undefined) {
      quiz.questions = patch.questions.map((q, i) => hydrateQuestion(quiz.id, i, q));
    }
    quiz.updatedAt = Date.now();
    return getStorage().quizzes.update(quiz);
  }

  async remove(hostId: string, quizId: string): Promise<void> {
    await this.get(hostId, quizId);
    await getStorage().quizzes.delete(quizId);
  }

  async duplicate(hostId: string, quizId: string): Promise<Quiz> {
    const source = await this.get(hostId, quizId);
    const now = Date.now();
    const copy: Quiz = {
      ...source,
      id: newId('quiz'),
      title: `${source.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
      questions: source.questions.map((q) => ({
        ...q,
        id: newId('q'),
        quizId: '',
        options: q.options.map((o) => ({ ...o, id: newId('opt') })),
      })),
    };
    copy.questions.forEach((q) => (q.quizId = copy.id));
    return getStorage().quizzes.create(copy);
  }

  /** FR-H3: reorder questions (drag & drop / move up-down). */
  async reorder(hostId: string, quizId: string, questionIds: string[]): Promise<Quiz> {
    const quiz = await this.get(hostId, quizId);
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    if (
      questionIds.length !== quiz.questions.length ||
      questionIds.some((id) => !byId.has(id))
    ) {
      throw httpError(400, 'questionIds must list every question exactly once');
    }
    quiz.questions = questionIds.map((id, i) => {
      const q = byId.get(id)!;
      q.orderIndex = i;
      return q;
    });
    quiz.updatedAt = Date.now();
    return getStorage().quizzes.update(quiz);
  }
}

export const quizService = new QuizService();
