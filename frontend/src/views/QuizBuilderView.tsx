import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Image as ImageIcon,
  Video as VideoIcon,
  Headphones,
  Upload,
  Eye,
  Save,
  ArrowUp,
  ArrowDown,
  X,
  Sparkles,
} from 'lucide-react';
import type { AnswerOption, Question, Quiz } from '../types/quiz';
import { storageService } from '../services/storage';
import { isRemote, mediaApi } from '../services/api';
import { AudioPlayer } from '../components/AudioPlayer';
import { VideoPlayer } from '../components/VideoPlayer';

interface QuizBuilderViewProps {
  quizId: string;
  onNavigate: (view: string, params?: any) => void;
}

const OPTION_COLORS = [
  { bg: 'bg-rose-500/10', border: 'border-rose-500/40', badge: 'bg-rose-600', text: 'text-rose-400', label: '▲ Red' },
  { bg: 'bg-sky-500/10', border: 'border-sky-500/40', badge: 'bg-sky-600', text: 'text-sky-400', label: '◆ Blue' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/40', badge: 'bg-amber-600', text: 'text-amber-400', label: '● Yellow' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', badge: 'bg-emerald-600', text: 'text-emerald-400', label: '■ Green' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/40', badge: 'bg-purple-600', text: 'text-purple-400', label: '✦ Purple' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', badge: 'bg-cyan-600', text: 'text-cyan-400', label: '★ Teal' },
];

/** Backend upload when reachable, FileReader data-URL fallback otherwise. */
async function resolveMediaUrl(file: File, maxMB: number): Promise<string> {
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`File exceeds ${maxMB} MB limit.`);
  }
  if (await isRemote()) {
    try {
      return await mediaApi.upload(file);
    } catch (err) {
      console.warn('[builder] upload failed, embedding locally', err);
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export const QuizBuilderView: React.FC<QuizBuilderViewProps> = ({
  quizId,
  onNavigate,
}) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    let mounted = true;
    storageService
      .getQuizById(quizId)
      .then((loaded) => {
        if (!mounted) return;
        setQuiz(
          loaded || {
            id: quizId,
            hostId: 'host-1',
            title: 'New Quiz',
            description: '',
            basePoints: 1000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            questions: [],
          }
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [quizId]);

  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [visualMediaType, setVisualMediaType] = useState<'image' | 'video'>('image');

  if (!quiz) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">
        Loading quiz…
      </div>
    );
  }

  const currentQuestion: Question | undefined = quiz.questions[activeQuestionIdx];

  const handleSave = async () => {
    try {
      const saved = await storageService.saveQuiz(quiz);
      setQuiz(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(err?.message || 'Could not save the quiz.');
    }
  };

  const handleAddQuestion = () => {
    const newQ: Question = {
      id: 'q-' + Math.random().toString(36).substring(2, 9),
      quizId: quiz.id,
      orderIndex: quiz.questions.length,
      prompt: 'New Question Prompt',
      timeLimitSec: 20,
      options: [
        { id: 'opt-1', text: 'Option 1', isCorrect: true },
        { id: 'opt-2', text: 'Option 2', isCorrect: false },
        { id: 'opt-3', text: 'Option 3', isCorrect: false },
        { id: 'opt-4', text: 'Option 4', isCorrect: false },
      ],
    };
    const updated = {
      ...quiz,
      questions: [...quiz.questions, newQ],
    };
    setQuiz(updated);
    setActiveQuestionIdx(updated.questions.length - 1);
  };

  const handleDeleteQuestion = (idx: number) => {
    if (quiz.questions.length <= 1) {
      alert('A quiz must have at least one question.');
      return;
    }
    const updatedQs = quiz.questions.filter((_, i) => i !== idx);
    setQuiz({ ...quiz, questions: updatedQs });
    setActiveQuestionIdx(Math.max(0, idx - 1));
  };

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= quiz.questions.length) return;
    const questionsCopy = [...quiz.questions];
    const [moved] = questionsCopy.splice(idx, 1);
    questionsCopy.splice(targetIdx, 0, moved);
    setQuiz({ ...quiz, questions: questionsCopy });
    setActiveQuestionIdx(targetIdx);
  };

  const updateCurrentQuestion = (partial: Partial<Question>) => {
    if (!currentQuestion) return;
    const updatedQs = [...quiz.questions];
    updatedQs[activeQuestionIdx] = { ...currentQuestion, ...partial };
    setQuiz({ ...quiz, questions: updatedQs });
  };

  const handleOptionTextChange = (optIdx: number, text: string) => {
    if (!currentQuestion) return;
    const newOptions = [...currentQuestion.options];
    newOptions[optIdx] = { ...newOptions[optIdx], text };
    updateCurrentQuestion({ options: newOptions });
  };

  const handleSetCorrectOption = (optId: string) => {
    if (!currentQuestion) return;
    const newOptions = currentQuestion.options.map((opt) => ({
      ...opt,
      isCorrect: opt.id === optId,
    }));
    updateCurrentQuestion({ options: newOptions });
  };

  const handleAddOption = () => {
    if (!currentQuestion || currentQuestion.options.length >= 6) return;
    const newOpt: AnswerOption = {
      id: 'opt-' + Math.random().toString(36).substring(2, 9),
      text: `Option ${currentQuestion.options.length + 1}`,
      isCorrect: false,
    };
    updateCurrentQuestion({ options: [...currentQuestion.options, newOpt] });
  };

  const handleRemoveOption = (optIdx: number) => {
    if (!currentQuestion || currentQuestion.options.length <= 2) return;
    const optToRemove = currentQuestion.options[optIdx];
    let newOptions = currentQuestion.options.filter((_, i) => i !== optIdx);
    if (optToRemove.isCorrect && newOptions.length > 0) {
      newOptions[0].isCorrect = true;
    }
    updateCurrentQuestion({ options: newOptions });
  };

  // Option media updates
  const handleUpdateOptionMedia = (
    optIdx: number,
    field: 'imageUrl' | 'videoUrl',
    value: string
  ) => {
    if (!currentQuestion) return;
    const newOptions = [...currentQuestion.options];
    newOptions[optIdx] = {
      ...newOptions[optIdx],
      // If setting image, clear video; if setting video, clear image
      imageUrl: field === 'imageUrl' ? value : undefined,
      videoUrl: field === 'videoUrl' ? value : undefined,
    };
    updateCurrentQuestion({ options: newOptions });
  };

  const handleOptionFileUpload = async (
    optIdx: number,
    type: 'image' | 'video',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await resolveMediaUrl(file, type === 'image' ? 5 : 25);
      handleUpdateOptionMedia(
        optIdx,
        type === 'image' ? 'imageUrl' : 'videoUrl',
        url
      );
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    }
  };

  // Question Image Upload
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await resolveMediaUrl(file, 5);
      updateCurrentQuestion({ imageUrl: url, videoUrl: '' });
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    }
  };

  // Question Video Upload
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await resolveMediaUrl(file, 25);
      updateCurrentQuestion({ videoUrl: url, imageUrl: '' });
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    }
  };

  // Question Audio Upload
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await resolveMediaUrl(file, 10);
      updateCurrentQuestion({ audioUrl: url });
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('host-dashboard')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <input
              type="text"
              value={quiz.title}
              onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              className="bg-transparent text-xl sm:text-2xl font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 -ml-1 border-b border-transparent hover:border-slate-700 transition-colors"
              placeholder="Quiz Title"
            />
            <p className="text-xs text-slate-400">
              {quiz.questions.length} questions • Speed-weighted scoring • Rich Media Options
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
          >
            <Eye className="h-4 w-4" />
            <span>Preview Question</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95 ${
              saveSuccess
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar Question List + Main Question Editor */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Questions Sidebar (Col 3) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Questions ({quiz.questions.length})
            </span>
            <button
              onClick={handleAddQuestion}
              className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
            {quiz.questions.map((q, idx) => {
              const isActive = idx === activeQuestionIdx;
              const hasVideo = !!q.videoUrl;
              const hasImage = !!q.imageUrl;
              const hasAudio = !!q.audioUrl;
              const hasOptMedia = q.options.some((o) => o.imageUrl || o.videoUrl);

              return (
                <div
                  key={q.id || idx}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-600/10 shadow-md shadow-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="truncate text-xs font-medium text-slate-200">
                      {q.prompt || 'Untitled Question'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {hasVideo && (
                      <span title="Question Video">
                        <VideoIcon className="h-3 w-3 text-cyan-400" />
                      </span>
                    )}
                    {hasImage && !hasVideo && (
                      <span title="Question Image">
                        <ImageIcon className="h-3 w-3 text-cyan-400" />
                      </span>
                    )}
                    {hasAudio && (
                      <span title="Question Audio">
                        <Headphones className="h-3 w-3 text-indigo-400" />
                      </span>
                    )}
                    {hasOptMedia && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400" title="Options have images/videos" />
                    )}

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveQuestion(idx, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveQuestion(idx, 'down');
                        }}
                        disabled={idx === quiz.questions.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Base Points Setting */}
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Quiz Base Points
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="500"
                max="5000"
                step="100"
                value={quiz.basePoints}
                onChange={(e) =>
                  setQuiz({ ...quiz, basePoints: parseInt(e.target.value) || 1000 })
                }
                className="w-28 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-bold text-indigo-400"
              />
              <span className="text-xs text-slate-400">pts default</span>
            </div>
          </div>
        </div>

        {/* Question Editor (Col 9) */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          {currentQuestion ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl">
              {/* Question Header: Prompt & Delete */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-300">
                      Question {activeQuestionIdx + 1} of {quiz.questions.length}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={currentQuestion.prompt}
                    onChange={(e) => updateCurrentQuestion({ prompt: e.target.value })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-base sm:text-lg font-bold text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Type your question prompt here..."
                  />
                </div>

                <button
                  onClick={() => handleDeleteQuestion(activeQuestionIdx)}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Delete this question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Question Media Section: Image/Video (with or without audio) */}
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Visual Media (Image OR Video) */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setVisualMediaType('image')}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            visualMediaType === 'image'
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>Image</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisualMediaType('video')}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            visualMediaType === 'video'
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <VideoIcon className="h-3.5 w-3.5" />
                          <span>Video</span>
                        </button>
                      </div>
                    </div>

                    {(currentQuestion.imageUrl || currentQuestion.videoUrl) && (
                      <button
                        onClick={() =>
                          updateCurrentQuestion({ imageUrl: '', videoUrl: '' })
                        }
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        Remove Visual
                      </button>
                    )}
                  </div>

                  {/* Image View / Upload */}
                  {visualMediaType === 'image' && (
                    <div>
                      {currentQuestion.imageUrl ? (
                        <div className="relative group overflow-hidden rounded-xl border border-slate-700 max-h-48 flex items-center justify-center bg-black/40">
                          <img
                            src={currentQuestion.imageUrl}
                            alt="Question image"
                            className="max-h-48 w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="url"
                            placeholder="Paste image URL (https://...)"
                            value={currentQuestion.imageUrl || ''}
                            onChange={(e) =>
                              updateCurrentQuestion({
                                imageUrl: e.target.value,
                                videoUrl: '',
                              })
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                          />
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Upload Image File (max 5 MB)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video View / Upload */}
                  {visualMediaType === 'video' && (
                    <div>
                      {currentQuestion.videoUrl ? (
                        <div className="space-y-2">
                          <VideoPlayer
                            src={currentQuestion.videoUrl}
                            autoPlay={true}
                            loop={true}
                            muted={false}
                            className="max-h-48"
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="url"
                            placeholder="Paste video URL (.mp4 / .webm)"
                            value={currentQuestion.videoUrl || ''}
                            onChange={(e) =>
                              updateCurrentQuestion({
                                videoUrl: e.target.value,
                                imageUrl: '',
                              })
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                          />
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors">
                            <Upload className="h-3.5 w-3.5" />
                            <span>Upload Video File (max 25 MB)</span>
                            <input
                              type="file"
                              accept="video/*"
                              onChange={handleVideoFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Separate Audio Clue (Host can include or omit audio!) */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <Headphones className="h-4 w-4 text-indigo-400" />
                      <span>Audio Clue (With or Without Audio)</span>
                    </div>
                    {currentQuestion.audioUrl && (
                      <button
                        onClick={() => updateCurrentQuestion({ audioUrl: '' })}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        Remove Audio
                      </button>
                    )}
                  </div>

                  {currentQuestion.audioUrl ? (
                    <div className="space-y-2">
                      <AudioPlayer src={currentQuestion.audioUrl} title="Audio Clue Preview" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="url"
                        placeholder="Paste audio URL (.mp3 / .wav)"
                        value={currentQuestion.audioUrl || ''}
                        onChange={(e) => updateCurrentQuestion({ audioUrl: e.target.value })}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                      />
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload Audio File (max 10 MB)</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Time Limit Setting */}
              <div className="mt-5 flex items-center justify-between border-y border-slate-800/80 py-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Question Time Limit
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10, 15, 20, 25, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => updateCurrentQuestion({ timeLimitSec: sec })}
                      className={`rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                        currentQuestion.timeLimitSec === sec
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer Options (with Images / Videos support!) */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Answer Choices (With Text, Images, or Videos)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Attach an image or video to any option for visual trivia!
                    </p>
                  </div>
                  {currentQuestion.options.length < 6 && (
                    <button
                      onClick={handleAddOption}
                      className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1 text-xs font-bold text-indigo-400 hover:bg-slate-700"
                    >
                      <Plus className="h-3 w-3" /> Add Choice
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {currentQuestion.options.map((option, optIdx) => {
                    const colorScheme = OPTION_COLORS[optIdx % OPTION_COLORS.length];
                    const hasMedia = !!(option.imageUrl || option.videoUrl);

                    return (
                      <div
                        key={option.id}
                        className={`relative flex flex-col rounded-2xl border p-3.5 transition-all ${
                          colorScheme.bg
                        } ${colorScheme.border} ${
                          option.isCorrect ? 'ring-2 ring-emerald-500/80 shadow-lg' : ''
                        }`}
                      >
                        {/* Top Row: Symbol Badge + Text Input + Correct Toggle + Delete */}
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-sm ${colorScheme.badge}`}
                          >
                            {colorScheme.label.split(' ')[0]}
                          </span>

                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) =>
                              handleOptionTextChange(optIdx, e.target.value)
                            }
                            className="flex-1 bg-transparent text-sm font-semibold text-white focus:outline-none placeholder-slate-500"
                            placeholder={`Choice ${optIdx + 1} text`}
                          />

                          {/* Correct Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleSetCorrectOption(option.id)}
                            className="p-1 transition-transform active:scale-90"
                            title={option.isCorrect ? 'Marked Correct' : 'Click to make Correct'}
                          >
                            {option.isCorrect ? (
                              <CheckCircle2 className="h-6 w-6 text-emerald-400 fill-emerald-500/20" />
                            ) : (
                              <Circle className="h-6 w-6 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>

                          {currentQuestion.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(optIdx)}
                              className="p-1 text-slate-500 hover:text-rose-400"
                              title="Remove choice"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Option Media Preview (if attached) */}
                        {hasMedia && (
                          <div className="relative mt-3 rounded-xl overflow-hidden border border-slate-700 bg-black/60 max-h-36 flex items-center justify-center group">
                            {option.imageUrl && (
                              <img
                                src={option.imageUrl}
                                alt={`Option ${optIdx + 1} visual`}
                                className="max-h-36 w-full object-cover rounded-xl"
                              />
                            )}
                            {option.videoUrl && (
                              <VideoPlayer
                                src={option.videoUrl}
                                autoPlay={true}
                                loop={true}
                                muted={true}
                                isThumbnail={true}
                                className="max-h-36 w-full"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateOptionMedia(optIdx, 'imageUrl', '')
                              }
                              className="absolute top-1.5 right-1.5 rounded-lg bg-black/70 p-1 text-rose-400 hover:text-rose-300"
                              title="Remove media"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Option Media Toolbar (Add Image or Video to this option) */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            {/* Attach Image button */}
                            <label className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-cyan-400">
                              <ImageIcon className="h-3 w-3" />
                              <span>Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleOptionFileUpload(optIdx, 'image', e)
                                }
                                className="hidden"
                              />
                            </label>

                            <span>•</span>

                            {/* Attach Video button */}
                            <label className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-cyan-400">
                              <VideoIcon className="h-3 w-3" />
                              <span>Video</span>
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) =>
                                  handleOptionFileUpload(optIdx, 'video', e)
                                }
                                className="hidden"
                              />
                            </label>

                            <span>•</span>

                            {/* URL input prompt */}
                            <button
                              type="button"
                              onClick={() => {
                                const url = prompt(
                                  'Enter direct Image or Video URL for this choice:'
                                );
                                if (url) {
                                  const isVid =
                                    url.endsWith('.mp4') ||
                                    url.endsWith('.webm') ||
                                    url.includes('video');
                                  handleUpdateOptionMedia(
                                    optIdx,
                                    isVid ? 'videoUrl' : 'imageUrl',
                                    url
                                  );
                                }
                              }}
                              className="text-slate-400 hover:text-white"
                            >
                              Paste URL
                            </button>
                          </div>

                          {option.isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              Correct Choice
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-96 items-center justify-center rounded-3xl border border-dashed border-slate-800 text-slate-500">
              Select or add a question from the left sidebar
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && currentQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">
                  Student Screen Preview (With Video & Option Media)
                </span>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-950 p-5 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white text-center">
                {currentQuestion.prompt}
              </h3>

              {/* Question Video Preview */}
              {currentQuestion.videoUrl && (
                <div className="flex justify-center max-h-56 overflow-hidden rounded-xl">
                  <VideoPlayer
                    src={currentQuestion.videoUrl}
                    autoPlay={true}
                    loop={true}
                    className="max-h-56 w-full"
                  />
                </div>
              )}

              {/* Question Image Preview */}
              {currentQuestion.imageUrl && !currentQuestion.videoUrl && (
                <div className="flex justify-center max-h-52 overflow-hidden rounded-xl">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Preview"
                    className="max-h-52 object-contain rounded-xl"
                  />
                </div>
              )}

              {/* Audio Clue Preview */}
              {currentQuestion.audioUrl && (
                <AudioPlayer src={currentQuestion.audioUrl} title="Audio Clue" />
              )}

              {/* Options Grid with Media */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {currentQuestion.options.map((opt, i) => {
                  const col = OPTION_COLORS[i % OPTION_COLORS.length];
                  return (
                    <div
                      key={opt.id}
                      className={`flex flex-col gap-2 rounded-2xl p-3 font-bold text-xs ${col.badge} text-white shadow-md`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{col.label.split(' ')[0]}</span>
                        <span className="truncate">{opt.text}</span>
                      </div>

                      {/* Option Image or Video Thumbnail */}
                      {opt.imageUrl && (
                        <img
                          src={opt.imageUrl}
                          alt=""
                          className="h-24 w-full object-cover rounded-xl"
                        />
                      )}
                      {opt.videoUrl && (
                        <VideoPlayer
                          src={opt.videoUrl}
                          isThumbnail={true}
                          muted={true}
                          autoPlay={true}
                          className="h-24 w-full"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
