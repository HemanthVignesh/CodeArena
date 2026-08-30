import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role } from "@codearena/db";
import { POST as runHandler } from "../app/api/run/route";
import { GET as runResultHandler } from "../app/api/run/[jobId]/route";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE_NAME, hashPassword } from "../lib/auth";
import { redis } from "../lib/redis";
import {
  MAX_SOURCE_CODE_BYTES,
  MAX_STDIN_BYTES,
  ExecutionStatus,
  RunJobResult,
} from "@codearena/judge-shared";

describe("CodeArena POST /api/run & GET /api/run/:jobId/result Suite", () => {
  let testUserId: string;
  let testSessionToken: string;
  let publishedProblemId: string;
  let unpublishedProblemId: string;

  beforeAll(async () => {
    const unique = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `run_user_${unique}@example.com`,
        username: `runuser${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    testUserId = user.id;

    const session = await createSession(testUserId);
    testSessionToken = session.sessionToken;

    const pubProblem = await prisma.problem.create({
      data: {
        slug: `run-pub-problem-${unique}`,
        title: "Run Test Problem (Published)",
        statement: "Return sum of two numbers",
        inputFormat: "a b",
        outputFormat: "sum",
        constraints: "1 <= a, b <= 100",
        isPublished: true,
      },
    });
    publishedProblemId = pubProblem.id;

    const unpubProblem = await prisma.problem.create({
      data: {
        slug: `run-unpub-problem-${unique}`,
        title: "Run Test Problem (Draft)",
        statement: "Draft problem",
        inputFormat: "x",
        outputFormat: "y",
        constraints: "none",
        isPublished: false,
      },
    });
    unpublishedProblemId = unpubProblem.id;
  });

  afterAll(async () => {
    if (publishedProblemId) {
      await prisma.problem.deleteMany({ where: { id: publishedProblemId } });
    }
    if (unpublishedProblemId) {
      await prisma.problem.deleteMany({ where: { id: unpublishedProblemId } });
    }
    if (testUserId) {
      await prisma.session.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  function createRequest(
    body: any,
    sessionToken?: string,
    method = "POST",
    url = "http://localhost:3000/api/run",
  ): NextRequest {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    if (sessionToken) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    }
    return new NextRequest(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
  }

  // ── 1. Authentication ──────────────────────────────────────────────────────

  it("1. Returns 401 when unauthenticated", async () => {
    const req = createRequest({
      problemId: publishedProblemId,
      language: "PYTHON",
      sourceCode: "print(1)",
    });
    const res = await runHandler(req);
    expect(res.status).toBe(401);
  });

  // ── 2. Validation ──────────────────────────────────────────────────────────

  it("2. Returns 400 for empty or missing problemId", async () => {
    const req = createRequest(
      {
        problemId: "",
        language: "PYTHON",
        sourceCode: "print(1)",
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(400);
  });

  it("3. Returns 400 for unsupported language", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "RUBY",
        sourceCode: "puts 1",
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unsupported language");
  });

  it("4. Returns 400 for empty sourceCode", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: "   ",
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sourceCode cannot be empty");
  });

  it("5. Returns 400 if sourceCode exceeds maximum allowed size (64 KB)", async () => {
    const hugeCode = "a".repeat(MAX_SOURCE_CODE_BYTES + 10);
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: hugeCode,
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sourceCode exceeds maximum allowed size");
  });

  it("6. Returns 400 if stdin exceeds maximum allowed size (16 KB)", async () => {
    const hugeStdin = "x".repeat(MAX_STDIN_BYTES + 10);
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: "print(1)",
        stdin: hugeStdin,
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("stdin exceeds maximum allowed size");
  });

  // ── 3. Problem Lookup & Security ───────────────────────────────────────────

  it("7. Returns 404 for non-existent problemId", async () => {
    const req = createRequest(
      {
        problemId: "non-existent-problem-id-12345",
        language: "PYTHON",
        sourceCode: "print(1)",
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(404);
  });

  it("8. Returns 404 for unpublished problem", async () => {
    const req = createRequest(
      {
        problemId: unpublishedProblemId,
        language: "PYTHON",
        sourceCode: "print(1)",
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(404);
  });

  // ── 4. Happy Path Run Creation ─────────────────────────────────────────────

  it("9. Creates run job and returns 202 with jobId for valid Python request", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: "print(input())",
        stdin: "hello custom stdin",
      },
      testSessionToken,
    );
    const res = await runHandler(req);
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data).toHaveProperty("jobId");
    expect(typeof data.jobId).toBe("string");
    expect(data.jobId.length).toBeGreaterThan(0);
  });

  // ── 5. Run Result Polling ──────────────────────────────────────────────────

  it("10. GET /api/run/:jobId/result returns 401 when unauthenticated", async () => {
    const req = createRequest(null, undefined, "GET");
    const res = await runResultHandler(req, {
      params: { jobId: "test-job-id" },
    });
    expect(res.status).toBe(401);
  });

  it("11. GET /api/run/:jobId/result returns PENDING when result not ready in Redis", async () => {
    const req = createRequest(null, testSessionToken, "GET");
    const res = await runResultHandler(req, {
      params: { jobId: `non-existent-job-${Date.now()}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("PENDING");
  });

  it("12. GET /api/run/:jobId/result returns DONE and safe result when present in Redis", async () => {
    const testJobId = `mock-job-${Date.now()}`;
    const mockResult: RunJobResult = {
      status: ExecutionStatus.SUCCESS,
      stdout: "5\n",
      stderr: "",
      exitCode: 0,
      executionTimeMs: 42,
      memoryUsedKb: 12400,
      signal: null,
    };

    await redis.set(
      `run:result:${testJobId}`,
      JSON.stringify(mockResult),
      "EX",
      60,
    );

    const req = createRequest(null, testSessionToken, "GET");
    const res = await runResultHandler(req, {
      params: { jobId: testJobId },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("DONE");
    expect(data.result.stdout).toBe("5\n");
    expect(data.result.executionTimeMs).toBe(42);
    expect(data.result.isSuccess).toBe(true);
    expect(data.result.isCompilationError).toBe(false);

    // Clean up mock Redis key
    await redis.del(`run:result:${testJobId}`);
  });
});
