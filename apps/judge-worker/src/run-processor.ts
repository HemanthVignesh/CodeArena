import Redis from "ioredis";
import { prisma } from "@codearena/db";
import {
  RunJobData,
  RunJobResult,
  ExecutionRequest,
  ExecutionMode,
  ExecutionStatus,
  DEFAULT_LIMITS,
  Language,
  RUN_RESULT_TTL_SECONDS,
} from "@codearena/judge-shared";
import { getRunner } from "./runners/index";
import { ExecutionOrchestrator } from "./orchestrator";

const orchestrator = new ExecutionOrchestrator();

/** Redis key for a run result */
export function runResultKey(jobId: string): string {
  return `run:result:${jobId}`;
}

/**
 * Processes an ephemeral Run job from the BullMQ "code-run" queue.
 *
 * Differences from processSubmissionJob:
 * - No Submission DB record created or updated.
 * - Fetches trusted problem limits (timeLimitMs, memoryLimitMb) from PostgreSQL.
 * - Executes exactly the user-supplied stdin against the user's source code.
 * - No test case comparison — purely a sandbox execution.
 * - Stores RunJobResult in Redis with RUN_RESULT_TTL_SECONDS TTL.
 * - Source code is NOT logged.
 * - Hidden test data is NOT fetched.
 */
export async function processRunJob(
  jobData: RunJobData,
  redisClient: Redis,
): Promise<void> {
  const { jobId, problemId, language, sourceCode, stdin, userId } = jobData;

  console.log(
    `[JudgeWorker] [RUN:${jobId}] Processing run job lang=${language} user=${userId ?? "anon"}`,
  );

  const resultKey = runResultKey(jobId);

  // Helper: store error result in Redis and exit
  const storeError = async (
    status: ExecutionStatus,
    errorMsg: string,
  ): Promise<void> => {
    const errResult: RunJobResult = {
      status,
      stdout: "",
      stderr: errorMsg,
      exitCode: null,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      signal: null,
    };
    await redisClient.set(
      resultKey,
      JSON.stringify(errResult),
      "EX",
      RUN_RESULT_TTL_SECONDS,
    );
  };

  // 1. Fetch problem to get trusted limits (do NOT fetch test cases)
  const problem = await prisma.problem.findFirst({
    where: {
      OR: [{ id: problemId }, { slug: problemId }],
      isPublished: true,
    },
    select: {
      id: true,
      timeLimitMs: true,
      memoryLimitMb: true,
    },
  });

  if (!problem) {
    console.warn(
      `[JudgeWorker] [RUN:${jobId}] Problem '${problemId}' not found or unpublished.`,
    );
    await storeError(ExecutionStatus.INTERNAL_ERROR, "Problem not found");
    return;
  }

  // 2. Get language runner (validated server-side — client cannot choose runner)
  let runner;
  try {
    runner = getRunner(language as Language);
  } catch {
    await storeError(
      ExecutionStatus.INTERNAL_ERROR,
      `Unsupported language: ${language}`,
    );
    return;
  }

  // 3. Determine trusted limits (from DB or defaults — never from client)
  const defaultLimits = DEFAULT_LIMITS[language as Language];
  const timeLimitMs = problem.timeLimitMs || defaultLimits.timeLimitMs;
  const memoryLimitMb = problem.memoryLimitMb || defaultLimits.memoryLimitMb;

  // 4. Execute via Docker sandbox
  const execRequest: ExecutionRequest = {
    jobId: `run-${jobId}`,
    language: language as Language,
    sourceCode, // User code — NOT logged
    stdin, // User-supplied stdin — safe to execute
    timeLimitMs,
    memoryLimitMb,
    mode: ExecutionMode.RUN,
  };

  let execResult;
  try {
    execResult = await orchestrator.execute(execRequest, runner);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[JudgeWorker] [RUN:${jobId}] Execution threw: ${errMsg}`);
    await storeError(ExecutionStatus.INTERNAL_ERROR, "Execution failed");
    return;
  }

  // 5. Store result in Redis — safe fields only, no hidden test data
  const runResult: RunJobResult = {
    status: execResult.status,
    stdout: execResult.stdout,
    stderr: execResult.stderr,
    compileOutput: execResult.compileOutput,
    exitCode: execResult.exitCode,
    executionTimeMs: execResult.executionTimeMs,
    memoryUsedKb: execResult.memoryUsedKb,
    signal: execResult.signal,
  };

  await redisClient.set(
    resultKey,
    JSON.stringify(runResult),
    "EX",
    RUN_RESULT_TTL_SECONDS,
  );

  console.log(
    `[JudgeWorker] [RUN:${jobId}] DONE status=${execResult.status} time=${execResult.executionTimeMs}ms`,
  );
}
