import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../utils/redis';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.headers['x-session-id'] as string || req.ip || 'unknown';
    const key = `${options.keyPrefix}:${identifier}`;

    try {
      const redis = getRedis();
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      const ttl = await redis.ttl(key);

      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - current));
      res.setHeader('X-RateLimit-Reset', ttl);

      if (current > options.maxRequests) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: ttl,
          message: `Rate limit exceeded. Try again in ${ttl} seconds.`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error('[RateLimiter] Error:', err);
      next();
    }
  };
}

export const dangerTapLimiter = createRateLimiter({
  windowSeconds: 300,
  maxRequests: 3,
  keyPrefix: 'rl:danger',
});

export const signalLimiter = createRateLimiter({
  windowSeconds: 10,
  maxRequests: 5,
  keyPrefix: 'rl:signal',
});
