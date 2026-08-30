import { Queue, ConnectionOptions } from "bullmq";
import { redis } from "./redis";
import {
  EXECUTION_QUEUE_NAME,
  RUN_QUEUE_NAME,
  SubmissionJobData,
  RunJobData,
  Language,
} from "@codearena/judge-shared";

declare global {
  // eslint-disable-next-line no-var
  var submissionQueueGlobal: Queue<SubmissionJobData> | undefined;
  // eslint-disable-next-line no-var
  var runQueueGlobal: Queue<RunJobData> | undefined;
}

// ── Submission Queue ─────────────────────────────────────────────────────────

export const submissionQueue =
  globalThis.submissionQueueGlobal ??
  new Queue<SubmissionJobData>(EXECUTION_QUEUE_NAME, {
    connection: redis as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.submissionQueueGlobal = submissionQueue;
}

/**
 * Enqueue a submission job to the BullMQ code execution queue.
 */
export async function enqueueSubmission(
  submissionId: string,
  problemId: string,
  userId?: string,
) {
  return submissionQueue.add(
    "execute-submission",
    {
      submissionId,
      problemId,
      userId,
    },
    {
      jobId: submissionId, // Use submissionId as BullMQ jobId for deduplication
    },
  );
}

// ── Run Queue ────────────────────────────────────────────────────────────────

export const runQueue =
  globalThis.runQueueGlobal ??
  new Queue<RunJobData>(RUN_QUEUE_NAME, {
    connection: redis as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts: 1, // No retry for run jobs — user can click Run again
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 200 },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.runQueueGlobal = runQueue;
}

/**
 * Enqueue an ephemeral run job to the BullMQ code-run queue.
 * The worker will store the result in Redis at run:result:{jobId}.
 */
export async function enqueueRunJob(
  jobId: string,
  problemId: string,
  language: Language,
  sourceCode: string,
  stdin: string,
  userId?: string,
) {
  return runQueue.add(
    "execute-run",
    {
      jobId,
      problemId,
      language,
      sourceCode,
      stdin,
      userId,
    },
    {
      jobId, // Use our generated jobId as BullMQ jobId
    },
  );
}
