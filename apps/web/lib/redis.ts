import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis =
  globalThis.redisGlobal ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.redisGlobal = redis;
}
