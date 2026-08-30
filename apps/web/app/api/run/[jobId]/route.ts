import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/auth";
import { RunJobResult, ExecutionStatus } from "@codearena/judge-shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/run/:jobId/result
 *
 * Polls for the result of an ephemeral run job.
 *
 * Security:
 * - Requires authentication
 * - Returns PENDING if result not yet available (client should poll again)
 * - Never returns hidden test data or expected outputs
 * - Never exposes Docker internals or worker implementation details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    // 1. Authenticate
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { jobId } = params;

    if (!jobId || typeof jobId !== "string" || jobId.trim() === "") {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }

    // 2. Fetch result from Redis
    const resultKey = `run:result:${jobId}`;
    const raw = await redis.get(resultKey);

    if (!raw) {
      // Result not ready yet — client should poll again
      return NextResponse.json({ status: "PENDING" }, { status: 200 });
    }

    // 3. Parse and return safe result fields only
    let result: RunJobResult;
    try {
      result = JSON.parse(raw) as RunJobResult;
    } catch {
      return NextResponse.json(
        { error: "Invalid result format" },
        { status: 500 },
      );
    }

    // Return only safe, user-facing fields — no Docker details, no internals
    return NextResponse.json(
      {
        status: "DONE",
        result: {
          executionStatus: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compileOutput ?? null,
          exitCode: result.exitCode,
          executionTimeMs: result.executionTimeMs,
          memoryUsedKb: result.memoryUsedKb > 0 ? result.memoryUsedKb : null,
          signal: result.signal,
          // Friendly classification for the UI
          isSuccess: result.status === ExecutionStatus.SUCCESS,
          isCompilationError:
            result.status === ExecutionStatus.COMPILATION_ERROR,
          isRuntimeError: result.status === ExecutionStatus.RUNTIME_ERROR,
          isTimeout: result.status === ExecutionStatus.TIMEOUT,
          isMemoryLimit: result.status === ExecutionStatus.MEMORY_LIMIT,
          isOutputLimit: result.status === ExecutionStatus.OUTPUT_LIMIT,
          isInternalError: result.status === ExecutionStatus.INTERNAL_ERROR,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Run Result API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
