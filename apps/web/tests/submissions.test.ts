import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role } from "@codearena/db";
import { POST as createSubmissionHandler } from "../app/api/submissions/route";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE_NAME, hashPassword } from "../lib/auth";

describe("CodeArena POST /api/submissions API Suite", () => {
  let testUserId: string;
  let testSessionToken: string;
  let publishedProblemId: string;
  let unpublishedProblemId: string;

  beforeAll(async () => {
    // 1. Create a dedicated test user & session
    const unique = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `sub_user_${unique}@example.com`,
        username: `subuser${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    testUserId = user.id;

    const session = await createSession(testUserId);
    testSessionToken = session.sessionToken;

    // 2. Create a published problem with test cases
    const pubProblem = await prisma.problem.create({
      data: {
        slug: `sub-pub-problem-${unique}`,
        title: "Submission Test Problem (Published)",
        statement: "Return sum of two numbers",
        inputFormat: "a b",
        outputFormat: "sum",
        constraints: "1 <= a, b <= 100",
        isPublished: true,
        testCases: {
          create: [
            {
              inputData: "2 3\n",
              expectedOutput: "5\n",
              isSample: true,
              isHidden: false,
              orderIndex: 0,
            },
            {
              inputData: "10 20\n",
              expectedOutput: "30\n",
              isSample: false,
              isHidden: true,
              orderIndex: 1,
            },
          ],
        },
      },
    });
    publishedProblemId = pubProblem.id;

    // 3. Create an unpublished draft problem
    const unpubProblem = await prisma.problem.create({
      data: {
        slug: `sub-unpub-problem-${unique}`,
        title: "Submission Test Problem (Draft)",
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
    // Clean up test data
    if (publishedProblemId) {
      await prisma.testCase.deleteMany({
        where: { problemId: publishedProblemId },
      });
      await prisma.submission.deleteMany({
        where: { problemId: publishedProblemId },
      });
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

  function createRequest(body: any, sessionToken?: string): NextRequest {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    if (sessionToken) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    }
    return new NextRequest("http://localhost:3000/api/submissions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  // ── 1. Authentication ──────────────────────────────────────────────────────

  it("1. should reject unauthenticated submission request with 401", async () => {
    const req = createRequest({
      problemId: publishedProblemId,
      language: "PYTHON",
      sourceCode: "print(5)",
    });

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // ── 2. Validation: Problem ID ──────────────────────────────────────────────

  it("2. should reject missing problemId with 400", async () => {
    const req = createRequest(
      {
        language: "PYTHON",
        sourceCode: "print(5)",
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("problemId");
  });

  it("3. should reject nonexistent problemId with 404", async () => {
    const req = createRequest(
      {
        problemId: "nonexistent-problem-id-9999",
        language: "PYTHON",
        sourceCode: "print(5)",
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(404);
  });

  it("4. should reject submission to an unpublished draft problem with 404", async () => {
    const req = createRequest(
      {
        problemId: unpublishedProblemId,
        language: "PYTHON",
        sourceCode: "print(5)",
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(404);
  });

  // ── 3. Validation: Language ────────────────────────────────────────────────

  it("5. should reject unsupported language with 400", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "JAVA", // Not in MVP allowlist
        sourceCode: "System.out.println(5);",
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unsupported language");
  });

  // ── 4. Validation: Source Code ─────────────────────────────────────────────

  it("6. should reject empty sourceCode with 400", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: "   \n  \t ",
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sourceCode");
  });

  it("7. should reject oversized sourceCode (> 64 KB) with 400", async () => {
    const oversizedCode = "a".repeat(65 * 1024); // 65 KB
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: oversizedCode,
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("exceeds maximum allowed size");
  });

  // ── 5. Successful Creation & Dispatch ──────────────────────────────────────

  it("8. should create a valid submission record with status QUEUED and return 201", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: "a, b = map(int, input().split())\nprint(a + b)",
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.submission).toBeDefined();
    expect(data.submission.id).toBeDefined();
    expect(data.submission.status).toBe("QUEUED");

    // Verify persisted in PostgreSQL
    const saved = await prisma.submission.findUnique({
      where: { id: data.submission.id },
    });
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe("QUEUED");
    expect(saved?.userId).toBe(testUserId);
    expect(saved?.problemId).toBe(publishedProblemId);
    expect(saved?.language).toBe("PYTHON");
    expect(saved?.code).toContain("print(a + b)");
  });

  it("9. should not allow client to inject verdict, limits, or test case data", async () => {
    const req = createRequest(
      {
        problemId: publishedProblemId,
        language: "PYTHON",
        sourceCode: "print(5)",
        // Injected fields that client attempts to override:
        verdict: "ACCEPTED",
        status: "COMPLETED",
        timeLimitMs: 99999,
        memoryLimitMb: 99999,
      },
      testSessionToken,
    );

    const res = await createSubmissionHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    const saved = await prisma.submission.findUnique({
      where: { id: data.submission.id },
    });
    // Verdict must be null or QUEUED, client override ignored
    expect(saved?.status).toBe("QUEUED");
    expect(saved?.verdict).toBeNull();
  });
});
