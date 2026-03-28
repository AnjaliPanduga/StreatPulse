import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redis: Redis | null = null;
let usingMock = false;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      redis = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn('[Redis] Connection failed — falling back to in-memory store');
            usingMock = true;
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      redis.on('error', () => {
        if (!usingMock) {
          console.warn('[Redis] Connection error — using in-memory fallback');
          usingMock = true;
        }
      });

    } catch {
      console.warn('[Redis] Init failed — using in-memory fallback');
      return createMockRedis();
    }
  }

  if (usingMock) {
    return createMockRedis();
  }

  return redis;
}

const memStore = new Map<string, { value: string; expiry: number }>();

function createMockRedis(): Redis {
  return new Proxy({} as Redis, {
    get: (_target, prop) => {
      if (prop === 'get') return async (key: string) => {
        const entry = memStore.get(key);
        if (!entry) return null;
        if (entry.expiry && Date.now() > entry.expiry) { memStore.delete(key); return null; }
        return entry.value;
      };
      if (prop === 'set') return async (key: string, value: string) => {
        memStore.set(key, { value, expiry: 0 });
        return 'OK';
      };
      if (prop === 'setex') return async (key: string, seconds: number, value: string) => {
        memStore.set(key, { value, expiry: Date.now() + seconds * 1000 });
        return 'OK';
      };
      if (prop === 'incr') return async (key: string) => {
        const entry = memStore.get(key);
        const val = entry ? parseInt(entry.value) + 1 : 1;
        memStore.set(key, { value: String(val), expiry: entry?.expiry || 0 });
        return val;
      };
      if (prop === 'expire') return async (key: string, seconds: number) => {
        const entry = memStore.get(key);
        if (entry) entry.expiry = Date.now() + seconds * 1000;
        return 1;
      };
      if (prop === 'ttl') return async (key: string) => {
        const entry = memStore.get(key);
        if (!entry || !entry.expiry) return -1;
        return Math.ceil((entry.expiry - Date.now()) / 1000);
      };
      if (prop === 'del') return async (key: string) => { memStore.delete(key); return 1; };
      if (prop === 'connect') return async () => {};
      if (prop === 'disconnect') return async () => {};
      if (prop === 'quit') return async () => {};
      if (prop === 'status') return 'ready';
      return () => {};
    }
  });
}
