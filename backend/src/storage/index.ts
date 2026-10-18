import env from '../config/env';
import { createMemoryStorage } from './memory';
import type { StorageBundle } from './interfaces';

/**
 * Storage factory. Currently only the in-memory driver ships, but the
 * repository interfaces in `interfaces.ts` map 1:1 to PostgreSQL tables
 * (users, quizzes, questions, options, sessions, participants, responses)
 * and the event bus / round store map to Redis pub/sub + hashes.
 *
 * To go production:
 *   1. STORAGE_DRIVER=postgres -> return a bundle backed by `pg` pools.
 *   2. CACHE_DRIVER=redis      -> roundResponses/eventBus via ioredis.
 *   3. MEDIA_DRIVER=s3         -> media routes via @aws-sdk/client-s3 presign.
 */
let cached: StorageBundle | null = null;

export function getStorage(): StorageBundle {
  if (cached) return cached;

  if (env.storageDriver === 'postgres' || env.cacheDriver === 'redis') {
    // Adapters are intentionally not bundled so the project runs with zero setup.
    console.warn(
      `[storage] STORAGE_DRIVER=${env.storageDriver}/CACHE_DRIVER=${env.cacheDriver} requested, but only the memory adapter is installed — falling back to in-memory storage.`
    );
  }

  cached = createMemoryStorage();
  return cached;
}
