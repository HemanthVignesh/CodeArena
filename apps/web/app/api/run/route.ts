import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@codearena/db";
import {
  MVP_LANGUAGES,
  MAX_SOURCE_CODE_BYTES,
  MAX_STDIN_BYTES,
  Language,
} from "@codearena/judge-shared";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueRunJob } from "@/lib/queue";

export const dynamic = "force-dynamic";

/**
 * POST /api/run
 *
 * Enqueues an ephemeral run job that executes user code against custom stdin
 * inside the Docker sandbox via the judge worker.
 *
 * Security:
 * - Requires authentication (401 if missing)
 * - Rate limited (20/min per user)
 * - Language validated against MVP allowlist
 * - Source code size capped at MAX_SOURCE_CODE_BYTES (64 KB)
 * - Stdin size capped at MAX_STDIN_BYTES (16 KB)
 * - Problem limits (timeLimitMs, memoryLimitMb) fetched from DB — NEVER from client
 * - No eval(), no child_process, no direct execution in Next.js
 * - Hidden test data is NOT fetched; only public problem metadata is used
 * - Source code is NOT logged
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required to run code" },
        { status: 401 },
      );
    }

    // 2. Per-user run rate limit (20 runs per minute)
    const rateLimitKey = `rl:run:${auth.user.id}`;
    const rl = await checkRateLimit(rateLimitKey, 20, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait before running again.",
          retryAfterSeconds: rl.resetSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.resetSeconds) },
        },
      );
    }

    // 3. Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const {
      problemId,
      language,
      sourceCode,
      stdin = "",
    } = body as Record<string, unknown>;

    // 4. Validate problemId
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

    // 5. Validate language — strict allowlist enforced server-side
    if (
      !language ||
      typeof language !== "string" ||
      !MVP_LANGUAGES.includes(language as Language)
    ) {
      return NextResponse.json(
        {
          error: `Unsupported language '${language}'. Supported: ${MVP_LANGUAGES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // 6. Validate sourceCode
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

    // 7. Validate stdin size
    if (typeof stdin !== "string") {
      return NextResponse.json(
        { error: "stdin must be a string" },
        { status: 400 },
      );
    }

    const stdinBytes = Buffer.byteLength(stdin, "utf8");
    if (stdinBytes > MAX_STDIN_BYTES) {
      return NextResponse.json(
        {
          error: `stdin exceeds maximum allowed size of ${MAX_STDIN_BYTES / 1024} KB`,
        },
        { status: 400 },
      );
    }

    // 8. Fetch published problem — server is authoritative for limits
    // We only fetch id to verify existence (limits are fetched by the worker)
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: problemId.trim() }, { slug: problemId.trim() }],
        isPublished: true,
      },
      select: {
        id: true,
      },
    });

    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found or is unpublished" },
        { status: 404 },
      );
    }

    // 9. Generate unique run job ID
    const jobId = crypto.randomUUID();

    // 10. Enqueue run job — worker will execute in Docker sandbox
    // Source code is NOT logged here — only metadata is logged
    try {
      await enqueueRunJob(
        jobId,
        problem.id,
        language as Language,
        sourceCode,
        stdin,
        auth.user.id,
      );
    } catch (queueError) {
      console.error("[Run API] Error enqueueing run job:", queueError);
      return NextResponse.json(
        { error: "Failed to queue run job. Please try again." },
        { status: 500 },
      );
    }

    console.log(
      `[Run API] Enqueued run job=${jobId} problem=${problem.id} lang=${language} user=${auth.user.id}`,
    );

    // 11. Return jobId immediately — client polls /api/run/:jobId
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    console.error("[Run API] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
