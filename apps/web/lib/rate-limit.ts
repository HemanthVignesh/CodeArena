import { redis } from "./redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

// In-memory fallback map if Redis is temporarily unreachable
const memoryFallback = new Map<string, { count: number; expiresAt: number }>();

/**
 * Sliding window / atomic counter rate limiter backed by Redis with in-memory fallback.
 * @param key Unique key to identify the rate limit target (e.g. `rl:auth:login:127.0.0.1`)
 * @param limit Maximum allowed requests within the time window
 * @param windowSeconds Time window in seconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);

    const results = await pipeline.exec();
    if (!results || results.length < 2) {
      throw new Error("Invalid Redis pipeline response");
    }

    const count = (results[0][1] as number) || 1;
    let ttl = results[1][1] as number;

    // If key has no expiration set yet (new key), set expiration
    if (ttl === -1 || count === 1) {
      await redis.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    console.warn(
      "[RateLimit] Redis error, falling back to memory:",
      (error as Error).message,
    );

    const now = Date.now();
    const entry = memoryFallback.get(key);

    if (!entry || now > entry.expiresAt) {
      memoryFallback.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetSeconds: windowSeconds,
      };
    }

    entry.count += 1;
    const remaining = Math.max(0, limit - entry.count);
    const resetSeconds = Math.ceil((entry.expiresAt - now) / 1000);

    return {
      allowed: entry.count <= limit,
      remaining,
      resetSeconds,
    };
  }
}
