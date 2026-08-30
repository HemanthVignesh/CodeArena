import Redis from "ioredis";
import { prisma } from "@codearena/db";
import {
  SubmissionJobData,
  ExecutionRequest,
  ExecutionMode,
  ExecutionStatus,
  Verdict,
  SubmissionStatus,
  DEFAULT_LIMITS,
  Language,
  SubmissionEventPayload,
  getSubmissionEventChannel,
} from "@codearena/judge-shared";
import { getRunner } from "./runners/index";
import { ExecutionOrchestrator } from "./orchestrator";
import { compareOutput } from "./evaluators/comparator";
import { workerConfig } from "./config";

const orchestrator = new ExecutionOrchestrator();

// Dedicated Redis client for publishing events (not managed by BullMQ)
const redisPubClient = new Redis(workerConfig.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

/**
 * Publishes a safe submission status event to Redis Pub/Sub.
 * Never publishes source code or hidden test data.
 */
export async function publishSubmissionEvent(
  submissionId: string,
  payload: SubmissionEventPayload,
): Promise<void> {
  try {
    const channel = getSubmissionEventChannel(submissionId);
    await redisPubClient.publish(channel, JSON.stringify(payload));
  } catch (err) {
    // Non-fatal: do not fail execution if pub/sub delivery fails
    console.warn(
      `[JudgeWorker] [SUBMISSION:${submissionId}] Failed to publish status event:`,
      (err as Error).message,
    );
  }
}

/**
 * Processes a submission job from the BullMQ queue:
 * 1. Fetches authoritative submission, problem, and test case records from PostgreSQL.
 * 2. Enforces idempotency (safely skips already finalized submissions).
 * 3. Updates status to RUNNING and publishes RUNNING event via Redis Pub/Sub.
 * 4. Executes test cases through the Step 5A isolated Docker sandbox.
 * 5. Deterministically compares stdout against expected output.
 * 6. Calculates final verdict with fail-fast semantics.
 * 7. Persists final verdict and statistics to PostgreSQL.
 * 8. Publishes COMPLETED event via Redis Pub/Sub with safe metrics.
 * 9. Atomically updates problem aggregate submission metrics.
 */
export async function processSubmissionJob(
  jobData: SubmissionJobData,
): Promise<{ submissionId: string; verdict: Verdict; passedCases: number }> {
  const { submissionId, problemId } = jobData;

  // 1. Fetch submission record
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        include: {
          testCases: {
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });

  if (!submission) {
    console.warn(
      `[JudgeWorker] [SUBMISSION:${submissionId}] Submission not found in database. Skipping.`,
    );
    return {
      submissionId,
      verdict: Verdict.INTERNAL_ERROR,
      passedCases: 0,
    };
  }

  // 2. Idempotency Check: if already finalized, safely skip
  if (submission.status === "COMPLETED") {
    console.log(
      `[JudgeWorker] [SUBMISSION:${submissionId}] Submission already completed with verdict ${submission.verdict}. Skipping re-processing.`,
    );
    return {
      submissionId,
      verdict:
        (submission.verdict as unknown as Verdict) ?? Verdict.INTERNAL_ERROR,
      passedCases: submission.passedCases,
    };
  }

  const problem = submission.problem;
  if (!problem) {
    console.error(
      `[JudgeWorker] [SUBMISSION:${submissionId}] Associated problem '${problemId}' not found.`,
    );
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        verdict: Verdict.INTERNAL_ERROR,
        errorMessage: "Associated problem not found",
      },
    });
    await publishSubmissionEvent(submissionId, {
      submissionId,
      status: SubmissionStatus.COMPLETED,
      verdict: Verdict.INTERNAL_ERROR,
      runtimeMs: null,
      memoryKb: null,
      passedCases: 0,
      totalCases: 0,
      errorMessage: "Associated problem not found",
    });
    return {
      submissionId,
      verdict: Verdict.INTERNAL_ERROR,
      passedCases: 0,
    };
  }

  const testCases = problem.testCases;
  if (!testCases || testCases.length === 0) {
    console.error(
      `[JudgeWorker] [SUBMISSION:${submissionId}] No test cases found for problem '${problem.id}'.`,
    );
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        verdict: Verdict.INTERNAL_ERROR,
        errorMessage: "No test cases configured for problem",
      },
    });
    await publishSubmissionEvent(submissionId, {
      submissionId,
      status: SubmissionStatus.COMPLETED,
      verdict: Verdict.INTERNAL_ERROR,
      runtimeMs: null,
      memoryKb: null,
      passedCases: 0,
      totalCases: 0,
      errorMessage: "No test cases configured for problem",
    });
    return {
      submissionId,
      verdict: Verdict.INTERNAL_ERROR,
      passedCases: 0,
    };
  }

  // 3. Mark status as RUNNING & publish RUNNING event
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "RUNNING" },
  });

  await publishSubmissionEvent(submissionId, {
    submissionId,
    status: SubmissionStatus.RUNNING,
    verdict: null,
    runtimeMs: null,
    memoryKb: null,
    passedCases: 0,
    totalCases: testCases.length,
  });

  // 4. Validate language runner
  let runner;
  try {
    runner = getRunner(submission.language as Language);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[JudgeWorker] [SUBMISSION:${submissionId}] Unsupported language: ${errorMsg}`,
    );
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: "COMPLETED",
        verdict: Verdict.INTERNAL_ERROR,
        errorMessage: `Unsupported language: ${submission.language}`,
      },
    });
    await publishSubmissionEvent(submissionId, {
      submissionId,
      status: SubmissionStatus.COMPLETED,
      verdict: Verdict.INTERNAL_ERROR,
      runtimeMs: null,
      memoryKb: null,
      passedCases: 0,
      totalCases: testCases.length,
      errorMessage: `Unsupported language: ${submission.language}`,
    });
    return {
      submissionId,
      verdict: Verdict.INTERNAL_ERROR,
      passedCases: 0,
    };
  }

  // Determine trusted limits
  const defaultLimits = DEFAULT_LIMITS[submission.language as Language];
  const timeLimitMs = problem.timeLimitMs || defaultLimits.timeLimitMs;
  const memoryLimitMb = problem.memoryLimitMb || defaultLimits.memoryLimitMb;

  let finalVerdict: Verdict = Verdict.ACCEPTED;
  let passedCases = 0;
  const totalCases = testCases.length;
  let totalExecutionTimeMs = 0;
  let maxMemoryUsedKb = 0;
  let compileOutput: string | undefined;
  let errorMessage: string | undefined;

  // 5. Test Case Execution Loop with Fail-Fast semantics
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const execRequest: ExecutionRequest = {
      jobId: `${submission.id}-tc${i + 1}`,
      language: submission.language as Language,
      sourceCode: submission.code,
      stdin: testCase.inputData,
      timeLimitMs,
      memoryLimitMb,
      mode: ExecutionMode.SUBMIT,
    };

    const result = await orchestrator.execute(execRequest, runner);

    if (result.compileOutput) {
      compileOutput = result.compileOutput;
    }

    totalExecutionTimeMs += result.executionTimeMs;
    if (result.memoryUsedKb > maxMemoryUsedKb) {
      maxMemoryUsedKb = result.memoryUsedKb;
    }

    // Map ExecutionStatus to final Verdict
    if (result.status === ExecutionStatus.COMPILATION_ERROR) {
      finalVerdict = Verdict.COMPILATION_ERROR;
      errorMessage = result.stderr || compileOutput || "Compilation failed";
      break; // Halt on compilation failure
    } else if (result.status === ExecutionStatus.TIMEOUT) {
      finalVerdict = Verdict.TIME_LIMIT_EXCEEDED;
      break;
    } else if (result.status === ExecutionStatus.MEMORY_LIMIT) {
      finalVerdict = Verdict.MEMORY_LIMIT_EXCEEDED;
      break;
    } else if (result.status === ExecutionStatus.OUTPUT_LIMIT) {
      finalVerdict = Verdict.RUNTIME_ERROR;
      errorMessage = "Output limit exceeded (max 1 MB)";
      break;
    } else if (result.status === ExecutionStatus.RUNTIME_ERROR) {
      finalVerdict = Verdict.RUNTIME_ERROR;
      errorMessage = result.stderr || "Runtime error occurred";
      break;
    } else if (result.status === ExecutionStatus.INTERNAL_ERROR) {
      finalVerdict = Verdict.INTERNAL_ERROR;
      errorMessage = result.errorReason || "Internal judge error";
      break;
    } else if (result.status === ExecutionStatus.SUCCESS) {
      const isMatch = compareOutput(result.stdout, testCase.expectedOutput);
      if (isMatch) {
        passedCases++;
      } else {
        finalVerdict = Verdict.WRONG_ANSWER;
        break; // Fail-fast on first mismatched test case
      }
    } else {
      finalVerdict = Verdict.INTERNAL_ERROR;
      break;
    }
  }

  // 6. Update Submission in PostgreSQL with final results
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: "COMPLETED",
      verdict: finalVerdict,
      passedCases,
      totalCases,
      executionTimeMs: totalExecutionTimeMs,
      memoryUsedKb: maxMemoryUsedKb,
      compileOutput: compileOutput ?? null,
      errorMessage: errorMessage ?? null,
    },
  });

  // 7. Publish COMPLETED event via Redis Pub/Sub
  await publishSubmissionEvent(submissionId, {
    submissionId,
    status: SubmissionStatus.COMPLETED,
    verdict: finalVerdict,
    runtimeMs: totalExecutionTimeMs,
    memoryKb: maxMemoryUsedKb > 0 ? maxMemoryUsedKb : null,
    passedCases,
    totalCases,
    compileOutput: compileOutput ?? null,
    errorMessage: errorMessage ?? null,
  });

  // 8. Atomically update Problem aggregate submission counts
  try {
    const isAccepted = finalVerdict === Verdict.ACCEPTED;
    const updatedProblem = await prisma.problem.update({
      where: { id: problem.id },
      data: {
        totalSubmissions: { increment: 1 },
        ...(isAccepted ? { totalAccepted: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        totalSubmissions: true,
        totalAccepted: true,
      },
    });

    if (updatedProblem.totalSubmissions > 0) {
      const rate =
        (updatedProblem.totalAccepted / updatedProblem.totalSubmissions) * 100;
      await prisma.problem.update({
        where: { id: problem.id },
        data: {
          acceptanceRate: Math.round(rate * 10) / 10,
        },
      });
    }
  } catch (statsError) {
    // If stats update fails, do not corrupt submission verdict
    console.error(
      `[JudgeWorker] [SUBMISSION:${submissionId}] Failed to update problem statistics:`,
      statsError,
    );
  }

  // 9. Structured logging — NO source code or hidden test data logged
  console.log(
    `[JudgeWorker] [SUBMISSION:${submissionId}] FINISHED verdict=${finalVerdict} passed=${passedCases}/${totalCases} time=${totalExecutionTimeMs}ms`,
  );

  return {
    submissionId,
    verdict: finalVerdict,
    passedCases,
  };
}
