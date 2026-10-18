import dotenv from 'dotenv';

dotenv.config();

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  storageDriver: (process.env.STORAGE_DRIVER || 'memory') as 'memory' | 'postgres',
  cacheDriver: (process.env.CACHE_DRIVER || 'memory') as 'memory' | 'redis',
  mediaDriver: (process.env.MEDIA_DRIVER || 'local') as 'local' | 's3',
  mediaDir: process.env.MEDIA_DIR || 'uploads',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
};

if (env.nodeEnv === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET must be set in production (Render: Environment → JWT_SECRET).'
    );
  }
  if (!process.env.CORS_ORIGINS) {
    console.warn(
      '[env] WARNING: CORS_ORIGINS is not set — browser and Socket.io clients ' +
        'from other origins will be rejected. Set it to your Vercel URL.'
    );
  }
  if (env.jwtSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET must not be the development default in production.');
  }
}

export type Env = typeof env;
export default env;
