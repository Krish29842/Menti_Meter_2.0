import { z } from 'zod';

const optionSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().trim().min(1, 'Option text is required').max(500),
  imageUrl: z.string().trim().max(2048).optional().or(z.literal('')),
  videoUrl: z.string().trim().max(2048).optional().or(z.literal('')),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    prompt: z.string().trim().min(1, 'Question prompt is required').max(2000),
    imageUrl: z.string().trim().max(2048).optional().or(z.literal('')),
    videoUrl: z.string().trim().max(2048).optional().or(z.literal('')),
    audioUrl: z.string().trim().max(2048).optional().or(z.literal('')),
    options: z
      .array(optionSchema)
      .min(2, 'At least 2 options are required')
      .max(6, 'At most 6 options are allowed'),
    timeLimitSec: z.number().int().min(5).max(120).optional(),
  })
  .superRefine((q, ctx) => {
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Exactly one option must be marked correct',
      });
    }
  });

export const quizInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().default(''),
  basePoints: z.number().int().min(100).max(10000).optional(),
  questions: z.array(questionInputSchema).default([]),
});

export const quizUpdateSchema = quizInputSchema.partial();

export const registerSchema = z.object({
  email: z.string().trim().email('Valid email required').max(320),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  name: z.string().trim().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email required').max(320),
  password: z.string().min(1).max(128),
});

export const createSessionSchema = z.object({
  quizId: z.string().min(1),
});

export const joinSessionSchema = z.object({
  code: z.string().trim().min(4).max(12),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(40)
    .optional(),
  avatar: z.string().trim().max(16).optional(),
});

export const answerSubmissionSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});

export const reorderSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type QuizInput = z.infer<typeof quizInputSchema>;
