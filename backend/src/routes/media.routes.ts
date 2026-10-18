import { randomUUID } from 'crypto';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import env from '../config/env';
import { authenticate, requireHost } from '../middleware/auth';
import { handler, HttpError } from '../middleware/error';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

const ALLOWED_TYPES = [...IMAGE_TYPES, ...AUDIO_TYPES, ...VIDEO_TYPES];

/** FR/§3.6 media limits: image ≤5MB, audio ≤10MB, video ≤50MB. */
const SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
};

function categoryOf(mimetype: string): 'image' | 'audio' | 'video' | null {
  if (IMAGE_TYPES.includes(mimetype)) return 'image';
  if (AUDIO_TYPES.includes(mimetype)) return 'audio';
  if (VIDEO_TYPES.includes(mimetype)) return 'video';
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.mediaDir),
  filename: (_req, file, cb) => {
    const ext = EXTENSIONS[file.mimetype] || path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(415, `Unsupported file type: ${file.mimetype}`));
  },
});

export const mediaRouter = Router();

mediaRouter.post(
  '/upload',
  authenticate,
  requireHost,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        const status = (err as { code?: string }).code === 'LIMIT_FILE_SIZE' ? 413 : 500;
        const message =
          status === 413 ? 'File too large (max 50MB)' : (err as Error).message;
        return next(new HttpError(status, message));
      }
      next();
    });
  },
  handler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file uploaded (use multipart field "file")');

    const category = categoryOf(file.mimetype)!;
    if (file.size > SIZE_LIMITS[category]) {
      const fs = await import('fs/promises');
      await fs.unlink(file.path).catch(() => undefined);
      throw new HttpError(
        413,
        `${category.toUpperCase()} files must be ≤ ${SIZE_LIMITS[category] / 1024 / 1024}MB`
      );
    }

    res.status(201).json({
      url: `/media/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      category,
    });
  })
);
