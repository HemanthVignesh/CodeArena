import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/submissions/:id
 *
 * Retrieves the full submission record, including the source code,
 * for an authorized user (the submission owner or an ADMIN).
 *
 * Security:
 * - Requires authentication (401 if unauthenticated)
 * - Strict ownership verification (403 if user does not own the submission)
 * - Returns source code ONLY to the authorized owner or admin
 * - Never returns hidden test inputs, expected outputs, or internal credentials
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 1. Authenticate user
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required to view submission details" },
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

    const submissionId = id.trim();

    // 2. Fetch submission with associated problem metadata
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
            statement: true,
            timeLimitMs: true,
            memoryLimitMb: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // 3. Authorization check: owner or ADMIN
    if (submission.userId !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Forbidden: You do not have permission to view this submission",
        },
        { status: 403 },
      );
    }

    // 4. Return safe payload with source code for authorized viewer
    return NextResponse.json(
      {
        submission: {
          id: submission.id,
          userId: submission.userId,
          problemId: submission.problemId,
          problem: submission.problem,
          language: submission.language,
          code: submission.code, // Authorized view: owner's submitted code
          status: submission.status,
          verdict: submission.verdict,
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
          passedCases:
            submission.status === "COMPLETED" ? submission.passedCases : null,
          totalCases:
            submission.status === "COMPLETED" ? submission.totalCases : null,
          compileOutput:
            submission.verdict === "COMPILATION_ERROR"
              ? submission.compileOutput
              : null,
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
    console.error("[Submission Detail API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred retrieving submission details" },
      { status: 500 },
    );
  }
}
