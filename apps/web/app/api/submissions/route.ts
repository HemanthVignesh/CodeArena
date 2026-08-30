import { NextRequest, NextResponse } from "next/server";
import { prisma, Language, Verdict } from "@codearena/db";
import {
  MVP_LANGUAGES,
  MAX_SOURCE_CODE_BYTES,
  SubmissionStatus,
  SubmissionEventPayload,
  getSubmissionEventChannel,
} from "@codearena/judge-shared";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueSubmission } from "@/lib/queue";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/submissions
 *
 * Retrieves a paginated list of submissions for the authenticated user.
 * Supports filtering by problem, language, and verdict.
 *
 * Security:
 * - Requires authentication (401 if unauthenticated)
 * - Returns ONLY submissions belonging to the authenticated user
 * - Strictly OMITS source code from list responses
 * - Validates all filter parameters against trusted enum allowlists
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required to view submission history" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);

    // 2. Parse & validate pagination parameters
    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

    const rawPageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const pageSize =
      isNaN(rawPageSize) || rawPageSize < 1 ? 20 : Math.min(rawPageSize, 100); // Hard cap at 100

    // 3. Parse & validate filters
    const problemParam = searchParams.get("problem")?.trim();
    const languageParam = searchParams.get("language")?.trim().toUpperCase();
    const verdictParam = searchParams.get("verdict")?.trim().toUpperCase();

    // Construct type-safe Prisma where clause — strictly scoped to authenticated user
    const where: any = {
      userId: auth.user.id,
    };

    // Filter by language (validated against enum)
    if (languageParam) {
      if (Object.values(Language).includes(languageParam as Language)) {
        where.language = languageParam as Language;
      } else {
        return NextResponse.json(
          { error: `Invalid language filter '${languageParam}'` },
          { status: 400 },
        );
      }
    }

    // Filter by verdict (validated against enum)
    if (verdictParam) {
      if (Object.values(Verdict).includes(verdictParam as Verdict)) {
        where.verdict = verdictParam as Verdict;
      } else {
        return NextResponse.json(
          { error: `Invalid verdict filter '${verdictParam}'` },
          { status: 400 },
        );
      }
    }

    // Filter by problem (by slug or id)
    if (problemParam) {
      where.problem = {
        OR: [{ slug: problemParam }, { id: problemParam }],
      };
    }

    // 4. Query total count and paginated items in parallel
    const [total, submissions] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          problemId: true,
          language: true,
          status: true,
          verdict: true,
          executionTimeMs: true,
          memoryUsedKb: true,
          passedCases: true,
          totalCases: true,
          createdAt: true,
          problem: {
            select: {
              id: true,
              slug: true,
              title: true,
              difficulty: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    // 5. Return safe payload (no source code, no hidden tests)
    return NextResponse.json(
      {
        submissions: submissions.map((s) => ({
          id: s.id,
          problemId: s.problemId,
          problem: s.problem,
          language: s.language,
          status: s.status,
          verdict: s.verdict,
          runtimeMs: s.status === "COMPLETED" ? s.executionTimeMs : null,
          memoryKb:
            s.status === "COMPLETED" && s.memoryUsedKb && s.memoryUsedKb > 0
              ? s.memoryUsedKb
              : null,
          passedCases: s.status === "COMPLETED" ? s.passedCases : null,
          totalCases: s.status === "COMPLETED" ? s.totalCases : null,
          createdAt: s.createdAt,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Submissions API] Error querying submissions:", error);
    return NextResponse.json(
      { error: "Failed to retrieve submission history" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/submissions
 *
 * Creates a new code submission for a published problem, validates payload,
 * applies per-user rate limits, creates a QUEUED database record, and
 * dispatches the job to the BullMQ judge queue.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required to submit code" },
        { status: 401 },
      );
    }

    // 2. Per-user submission rate limit (10 submissions per minute)
    const rateLimitKey = `rl:submit:${auth.user.id}`;
    const rl = await checkRateLimit(rateLimitKey, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait before submitting again.",
          retryAfterSeconds: rl.resetSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.resetSeconds) },
        },
      );
    }

    // 3. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { problemId, language, sourceCode } = body;

    // Validate problemId
    if (
      !problemId ||
      typeof problemId !== "string" ||
      problemId.trim() === ""
    ) {
      return NextResponse.json(
        { error: "problemId is required" },
        { status: 400 },
      );
    }

    // Validate language
    if (
      !language ||
      typeof language !== "string" ||
      !MVP_LANGUAGES.includes(language as any)
    ) {
      return NextResponse.json(
        {
          error: `Unsupported language '${language}'. Supported: ${MVP_LANGUAGES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate sourceCode
    if (
      !sourceCode ||
      typeof sourceCode !== "string" ||
      sourceCode.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "sourceCode cannot be empty" },
        { status: 400 },
      );
    }

    const codeBytes = Buffer.byteLength(sourceCode, "utf8");
    if (codeBytes > MAX_SOURCE_CODE_BYTES) {
      return NextResponse.json(
        {
          error: `sourceCode exceeds maximum allowed size of ${MAX_SOURCE_CODE_BYTES / 1024} KB`,
        },
        { status: 400 },
      );
    }

    // 4. Fetch published problem (support lookup by id or slug)
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: problemId }, { slug: problemId }],
        isPublished: true,
      },
      select: {
        id: true,
        isPublished: true,
      },
    });

    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found or is unpublished" },
        { status: 404 },
      );
    }

    // 5. Create Submission record in PostgreSQL with status QUEUED
    const submission = await prisma.submission.create({
      data: {
        userId: auth.user.id,
        problemId: problem.id,
        language: language as Language,
        code: sourceCode,
        status: "QUEUED",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    // 6. Publish QUEUED event to Redis Pub/Sub for immediate SSE broadcast
    const queuedEvent: SubmissionEventPayload = {
      submissionId: submission.id,
      status: SubmissionStatus.QUEUED,
      verdict: null,
      runtimeMs: null,
      memoryKb: null,
      passedCases: null,
      totalCases: null,
    };
    redis
      .publish(
        getSubmissionEventChannel(submission.id),
        JSON.stringify(queuedEvent),
      )
      .catch((pubErr) => {
        console.warn(
          `[Submissions API] Failed to publish initial QUEUED event:`,
          (pubErr as Error).message,
        );
      });

    // 7. Enqueue BullMQ execution job
    try {
      await enqueueSubmission(submission.id, problem.id, auth.user.id);
    } catch (queueError) {
      console.error(
        "[Submissions API] Error enqueueing submission to BullMQ:",
        queueError,
      );

      // Handle DB/queue consistency: mark submission as INTERNAL_ERROR
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: "COMPLETED",
          verdict: "INTERNAL_ERROR",
          errorMessage: "Failed to dispatch execution job to queue.",
        },
      });

      return NextResponse.json(
        { error: "Failed to queue submission job. Please try again." },
        { status: 500 },
      );
    }

    // 8. Return minimal representation (no sensitive test data or code)
    return NextResponse.json(
      {
        submission: {
          id: submission.id,
          status: submission.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Submissions API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing submission" },
      { status: 500 },
    );
  }
}
