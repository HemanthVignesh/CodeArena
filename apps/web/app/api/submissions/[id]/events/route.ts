import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";
import {
  SubmissionEventPayload,
  SubmissionStatus,
  Verdict,
  getSubmissionEventChannel,
  SUBMISSION_SSE_EVENT_NAME,
} from "@codearena/judge-shared";

export const dynamic = "force-dynamic";

// Heartbeat interval to keep long-lived connections and proxies alive
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * GET /api/submissions/:id/events
 *
 * Streams real-time submission status and verdict updates via Server-Sent Events (SSE).
 *
 * Security & Reliability:
 * - Requires authentication (401 if missing)
 * - Strict ownership isolation: users can only stream their own submissions (403/404)
 * - Returns text/event-stream with no-buffering headers
 * - Automatically sends final state & closes stream if already COMPLETED
 * - Dedicated Redis Pub/Sub subscription per connection, cleanly closed on disconnect
 * - Heartbeat ping every 15s prevents proxy/firewall timeouts
 * - Never transmits source code or hidden test data
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
        { error: "Authentication required to stream submission events" },
        { status: 401 },
      );
    }

    const { id } = params;
    if (!id || typeof id !== "string" || id.trim() === "") {
      return NextResponse.json(
        { error: "Invalid submission ID" },
        { status: 400 },
      );
    }

    const submissionId = id.trim();

    // 2. Query submission record to verify existence and check ownership
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        userId: true,
        status: true,
        verdict: true,
        executionTimeMs: true,
        memoryUsedKb: true,
        passedCases: true,
        totalCases: true,
        compileOutput: true,
        errorMessage: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Ownership check (owner or ADMIN allowed)
    if (submission.userId !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Forbidden: You do not have permission to view this submission",
        },
        { status: 403 },
      );
    }

    // 3. Helper to format SSE events
    const encoder = new TextEncoder();
    const formatSSEMessage = (event: string, data: any): Uint8Array => {
      return encoder.encode(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      );
    };
    const formatSSEComment = (comment: string): Uint8Array => {
      return encoder.encode(`: ${comment}\n\n`);
    };

    // 4. If submission is ALREADY completed, return immediate stream with single event & close
    if (submission.status === "COMPLETED") {
      const completedPayload: SubmissionEventPayload = {
        submissionId: submission.id,
        status: SubmissionStatus.COMPLETED,
        verdict: (submission.verdict as unknown as Verdict) ?? null,
        runtimeMs: submission.executionTimeMs,
        memoryKb:
          submission.memoryUsedKb && submission.memoryUsedKb > 0
            ? submission.memoryUsedKb
            : null,
        passedCases: submission.passedCases,
        totalCases: submission.totalCases,
        compileOutput:
          submission.verdict === "COMPILATION_ERROR"
            ? submission.compileOutput
            : null,
        errorMessage:
          submission.verdict && submission.verdict !== "ACCEPTED"
            ? submission.errorMessage
            : null,
      };

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            formatSSEMessage(SUBMISSION_SSE_EVENT_NAME, completedPayload),
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform, no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // 5. Submission is pending or running — establish Redis Pub/Sub subscription
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    const channel = getSubmissionEventChannel(submissionId);
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let isClosed = false;

    const cleanup = async () => {
      if (isClosed) return;
      isClosed = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch {
        // Ignore cleanup errors on disconnect
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        // 5a. Send initial status snapshot immediately
        const initialPayload: SubmissionEventPayload = {
          submissionId: submission.id,
          status: submission.status as SubmissionStatus,
          verdict: (submission.verdict as unknown as Verdict) ?? null,
          runtimeMs: submission.executionTimeMs,
          memoryKb:
            submission.memoryUsedKb && submission.memoryUsedKb > 0
              ? submission.memoryUsedKb
              : null,
          passedCases: submission.passedCases,
          totalCases: submission.totalCases,
        };
        controller.enqueue(
          formatSSEMessage(SUBMISSION_SSE_EVENT_NAME, initialPayload),
        );

        // 5b. Start heartbeat timer
        heartbeatTimer = setInterval(() => {
          if (!isClosed) {
            try {
              controller.enqueue(formatSSEComment("ping"));
            } catch {
              cleanup();
            }
          }
        }, HEARTBEAT_INTERVAL_MS);

        // 5c. Listen for Redis Pub/Sub messages
        subscriber.on("message", (msgChannel, rawMessage) => {
          if (msgChannel === channel && !isClosed) {
            try {
              const payload = JSON.parse(rawMessage) as SubmissionEventPayload;
              controller.enqueue(
                formatSSEMessage(SUBMISSION_SSE_EVENT_NAME, payload),
              );

              // If submission has reached terminal COMPLETED state, close stream
              if (payload.status === SubmissionStatus.COMPLETED) {
                cleanup().then(() => {
                  try {
                    controller.close();
                  } catch {
                    // Controller may already be closed
                  }
                });
              }
            } catch (err) {
              console.warn(
                `[SSE:${submissionId}] Error handling message payload:`,
                err,
              );
            }
          }
        });

        subscriber.on("error", (err) => {
          console.warn(`[SSE:${submissionId}] Subscriber error:`, err.message);
        });

        // 5d. Subscribe to the channel
        try {
          await subscriber.subscribe(channel);
        } catch (subErr) {
          console.error(
            `[SSE:${submissionId}] Failed to subscribe to channel:`,
            subErr,
          );
          await cleanup();
          controller.error(subErr);
        }
      },
      cancel() {
        // Client disconnected (e.g. tab closed or navigation)
        cleanup();
      },
    });

    // Clean up if the request is aborted
    req.signal.addEventListener("abort", () => {
      cleanup();
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform, no-store",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[SSE API] Unexpected error establishing SSE stream:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred establishing event stream" },
      { status: 500 },
    );
  }
}
