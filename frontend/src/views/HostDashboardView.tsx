import React, { useState } from 'react';
import {
  Plus,
  Play,
  Edit3,
  Copy,
  Trash2,
  HelpCircle,
  Headphones,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';
import type { Quiz } from '../types/quiz';
import { storageService } from '../services/storage';
import { realtimeEngine } from '../services/realtimeEngine';

interface HostDashboardViewProps {
  onNavigate: (view: string, params?: any) => void;
}

export const HostDashboardView: React.FC<HostDashboardViewProps> = ({
  onNavigate,
}) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(storageService.getQuizzes());
  const currentUser = storageService.getCurrentUser();

  const handleCreateQuiz = () => {
    const newQuiz: Quiz = {
      id: 'quiz-' + Math.random().toString(36).substring(2, 9),
      hostId: currentUser?.id || 'host-1',
      title: 'Untitled Quiz',
      description: 'Add a captivating description for your live session',
      basePoints: 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      questions: [
        {
          id: 'q-' + Math.random().toString(36).substring(2, 9),
          quizId: '',
          orderIndex: 0,
          prompt: 'What is the answer to this question?',
          timeLimitSec: 20,
          options: [
            { id: 'opt-1', text: 'Option A', isCorrect: true },
            { id: 'opt-2', text: 'Option B', isCorrect: false },
            { id: 'opt-3', text: 'Option C', isCorrect: false },
            { id: 'opt-4', text: 'Option D', isCorrect: false },
          ],
        },
      ],
    };
    storageService.saveQuiz(newQuiz);
    setQuizzes(storageService.getQuizzes());
    onNavigate('quiz-builder', { quizId: newQuiz.id });
  };

  const handleLaunchSession = (quizId: string) => {
    const session = realtimeEngine.createSession(
      quizId,
      currentUser?.id || 'host-1'
    );
    onNavigate('host-live', { sessionId: session.id, quizId });
  };

  const handleDuplicate = (id: string) => {
    const copy = storageService.duplicateQuiz(id);
    if (copy) {
      setQuizzes(storageService.getQuizzes());
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this quiz?')) {
      storageService.deleteQuiz(id);
      setQuizzes(storageService.getQuizzes());
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Host Studio
            </h1>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              {quizzes.length} Quizzes
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Create, manage and broadcast multimedia live sessions to your audience.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateQuiz}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Quiz</span>
          </button>
        </div>
      </div>

      {/* Quiz Cards Grid */}
      {quizzes.length === 0 ? (
        <div className="mt-16 text-center rounded-3xl border border-dashed border-slate-800 p-12 max-w-lg mx-auto">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-4">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No Quizzes Created Yet</h3>
          <p className="mt-2 text-sm text-slate-400">
            Get started by creating your first interactive multimedia quiz with images and sound!
          </p>
          <button
            onClick={handleCreateQuiz}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Create First Quiz
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const hasAudio = quiz.questions.some((q) => !!q.audioUrl);
            const hasImage = quiz.questions.some((q) => !!q.imageUrl);

            return (
              <div
                key={quiz.id}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur-sm transition-all hover:border-indigo-500/50 hover:shadow-indigo-500/10"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {quiz.title}
                    </h3>
                  </div>

                  <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {quiz.description || 'No description provided.'}
                  </p>

                  {/* Badges / Metadata */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                      <HelpCircle className="h-3 w-3 text-indigo-400" />
                      {quiz.questions.length} Questions
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                      <Zap className="h-3 w-3 text-amber-400" />
                      {quiz.basePoints} pts base
                    </span>

                    {hasAudio && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 border border-indigo-500/20">
                        <Headphones className="h-3 w-3 text-indigo-400" />
                        Audio Clues
                      </span>
                    )}

                    {hasImage && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 border border-cyan-500/20">
                        <ImageIcon className="h-3 w-3 text-cyan-400" />
                        Images
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-6 border-t border-slate-800/80 pt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleLaunchSession(quiz.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:opacity-95 active:scale-98 transition-all"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Launch Live Session</span>
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() =>
                        onNavigate('quiz-builder', { quizId: quiz.id })
                      }
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(quiz.id)}
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      onClick={() => handleDelete(quiz.id)}
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
