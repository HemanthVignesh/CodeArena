import { Worker, ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { workerConfig } from "./config";
import {
  SubmissionJobData,
  RunJobData,
  RUN_QUEUE_NAME,
} from "@codearena/judge-shared";
import { processSubmissionJob } from "./processor";
import { processRunJob } from "./run-processor";

console.log("=========================================");
console.log("   CodeArena Judge Worker Engine         ");
console.log("=========================================");
console.log(`[JudgeWorker] Environment: ${workerConfig.nodeEnv}`);
console.log(`[JudgeWorker] Submission Queue: ${workerConfig.queueName}`);
console.log(`[JudgeWorker] Run Queue:        ${RUN_QUEUE_NAME}`);
console.log(`[JudgeWorker] Connecting to Redis at ${workerConfig.redisUrl}...`);

const redisConnection = new Redis(workerConfig.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on("connect", () => {
  console.log("[JudgeWorker] [OK] Successfully connected to Redis.");
});

redisConnection.on("error", (err) => {
  console.error("[JudgeWorker] [ERROR] Redis connection error:", err.message);
});

// ── Submission Worker (code-execution queue) ──────────────────────────────────

export const worker = new Worker<SubmissionJobData>(
  workerConfig.queueName,
  async (job) => {
    const jobId = job.id ?? "unknown";
    const { submissionId, problemId } = job.data;

    console.log(
      `[JudgeWorker] [JOB:${jobId}] Processing submission=${submissionId} problem=${problemId}`,
    );

    return processSubmissionJob(job.data);
  },
  {
    connection: redisConnection as unknown as ConnectionOptions,
    concurrency: workerConfig.concurrency,
    autorun: true,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
);

worker.on("ready", () => {
  console.log(
    `[JudgeWorker] [READY] Submission worker listening on queue '${workerConfig.queueName}'`,
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[JudgeWorker] [FAILED] Submission job ${job?.id ?? "unknown"}: ${err.message}`,
  );
});

worker.on("error", (err) => {
  console.error("[JudgeWorker] Submission worker error:", err.message);
});

// ── Run Worker (code-run queue) ───────────────────────────────────────────────

// Dedicated BullMQ connection for the run worker
const runRedisConnection = new Redis(workerConfig.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Separate ioredis client for writing run results — not managed by BullMQ
const runResultRedis = new Redis(workerConfig.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

export const runWorker = new Worker<RunJobData>(
  RUN_QUEUE_NAME,
  async (job) => {
    const { jobId } = job.data;
    console.log(`[JudgeWorker] [RUN:${jobId}] Dequeued run job`);
    await processRunJob(job.data, runResultRedis);
  },
  {
    connection: runRedisConnection as unknown as ConnectionOptions,
    concurrency: workerConfig.concurrency,
    autorun: true,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
);

runWorker.on("ready", () => {
  console.log(
    `[JudgeWorker] [READY] Run worker listening on queue '${RUN_QUEUE_NAME}'`,
  );
  console.log("=========================================");
});

runWorker.on("failed", (job, err) => {
  console.error(
    `[JudgeWorker] [FAILED] Run job ${job?.id ?? "unknown"}: ${err.message}`,
  );
});

runWorker.on("error", (err) => {
  console.error("[JudgeWorker] Run worker error:", err.message);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
const handleShutdown = async (signal: string) => {
  console.log(
    `\n[JudgeWorker] Received ${signal}. Gracefully closing workers and Redis connections...`,
  );
  try {
    await Promise.all([worker.close(), runWorker.close()]);
    await Promise.all([
      redisConnection.quit(),
      runRedisConnection.quit(),
      runResultRedis.quit(),
    ]);
    console.log("[JudgeWorker] Clean shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[JudgeWorker] Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
