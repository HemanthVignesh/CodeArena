import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/submissions/:id/status
 *
 * Returns the current status and verdict of a submission.
 * Used by the browser to poll for submission progress.
 *
 * Security:
 * - Requires authentication
 * - Only returns submissions owned by the requesting user
 * - Returns only safe public fields
 * - Never returns: source code, hidden test inputs, expected outputs,
 *   internal error details, or database implementation details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
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

    const { id } = params;

    if (!id || typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 },
      );
    }

    // 2. Fetch submission — only fields needed for status display
    // Filter by userId to prevent cross-user status peeking
    const submission = await prisma.submission.findFirst({
      where: {
        id: id.trim(),
        userId: auth.user.id, // Ownership check
      },
      select: {
        id: true,
        status: true,
        verdict: true,
        executionTimeMs: true,
        memoryUsedKb: true,
        passedCases: true,
        totalCases: true,
        // Compile output is safe (it's compiler errors, not test data)
        compileOutput: true,
        // Error message shown only on non-accepted verdicts
        errorMessage: true,
        createdAt: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // 3. Return safe subset — no source code, no hidden test data
    return NextResponse.json(
      {
        submission: {
          id: submission.id,
          status: submission.status,
          verdict: submission.verdict,
          // Runtime/memory only after completion
          runtimeMs:
            submission.status === "COMPLETED"
              ? submission.executionTimeMs
              : null,
          memoryKb:
            submission.status === "COMPLETED" &&
            submission.memoryUsedKb &&
            submission.memoryUsedKb > 0
              ? submission.memoryUsedKb
              : null,
          // Test case counts — safe to expose
          passedCases:
            submission.status === "COMPLETED" ? submission.passedCases : null,
          totalCases:
            submission.status === "COMPLETED" ? submission.totalCases : null,
          // Compiler output for COMPILATION_ERROR — safe (it's the user's own code errors)
          compileOutput:
            submission.verdict === "COMPILATION_ERROR"
              ? submission.compileOutput
              : null,
          // Generic error message for display
          errorMessage:
            submission.verdict && submission.verdict !== "ACCEPTED"
              ? submission.errorMessage
              : null,
          createdAt: submission.createdAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Submission Status API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
