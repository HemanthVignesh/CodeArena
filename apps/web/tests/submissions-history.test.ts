import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role, Language, Verdict } from "@codearena/db";
import { GET as listSubmissionsHandler } from "../app/api/submissions/route";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE_NAME, hashPassword } from "../lib/auth";

describe("CodeArena GET /api/submissions History Suite", () => {
  let user1Id: string;
  let user1SessionToken: string;
  let user2Id: string;
  let user2SessionToken: string;
  let problem1Id: string;
  let problem2Id: string;

  beforeAll(async () => {
    const unique = Date.now();

    // User 1
    const user1 = await prisma.user.create({
      data: {
        email: `hist_u1_${unique}@example.com`,
        username: `histu1_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user1Id = user1.id;
    const session1 = await createSession(user1Id);
    user1SessionToken = session1.sessionToken;

    // User 2
    const user2 = await prisma.user.create({
      data: {
        email: `hist_u2_${unique}@example.com`,
        username: `histu2_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user2Id = user2.id;
    const session2 = await createSession(user2Id);
    user2SessionToken = session2.sessionToken;

    // Problem 1
    const problem1 = await prisma.problem.create({
      data: {
        slug: `hist-prob1-${unique}`,
        title: "History Problem 1",
        statement: "Problem 1",
        inputFormat: "none",
        outputFormat: "none",
        constraints: "none",
        isPublished: true,
      },
    });
    problem1Id = problem1.id;

    // Problem 2
    const problem2 = await prisma.problem.create({
      data: {
        slug: `hist-prob2-${unique}`,
        title: "History Problem 2",
        statement: "Problem 2",
        inputFormat: "none",
        outputFormat: "none",
        constraints: "none",
        isPublished: true,
      },
    });
    problem2Id = problem2.id;

    // Create 3 submissions for User 1
    await prisma.submission.createMany({
      data: [
        {
          userId: user1Id,
          problemId: problem1Id,
          language: Language.PYTHON,
          code: "print('u1 p1 py accepted')",
          status: "COMPLETED",
          verdict: Verdict.ACCEPTED,
          executionTimeMs: 30,
          memoryUsedKb: 10000,
          passedCases: 2,
          totalCases: 2,
          createdAt: new Date(Date.now() - 3000),
        },
        {
          userId: user1Id,
          problemId: problem1Id,
          language: Language.CPP,
          code: "print('u1 p1 cpp wa')",
          status: "COMPLETED",
          verdict: Verdict.WRONG_ANSWER,
          executionTimeMs: 15,
          memoryUsedKb: 8000,
          passedCases: 0,
          totalCases: 2,
          createdAt: new Date(Date.now() - 2000),
        },
        {
          userId: user1Id,
          problemId: problem2Id,
          language: Language.TYPESCRIPT,
          code: "print('u1 p2 ts tle')",
          status: "COMPLETED",
          verdict: Verdict.TIME_LIMIT_EXCEEDED,
          executionTimeMs: 2000,
          memoryUsedKb: 15000,
          passedCases: 0,
          totalCases: 2,
          createdAt: new Date(Date.now() - 1000),
        },
      ],
    });

    // Create 1 submission for User 2
    await prisma.submission.create({
      data: {
        userId: user2Id,
        problemId: problem1Id,
        language: Language.PYTHON,
        code: "print('u2 p1 py secret')",
        status: "COMPLETED",
        verdict: Verdict.ACCEPTED,
      },
    });
  });

  afterAll(async () => {
    if (problem1Id || problem2Id) {
      await prisma.submission.deleteMany({
        where: { problemId: { in: [problem1Id, problem2Id] } },
      });
      await prisma.problem.deleteMany({
        where: { id: { in: [problem1Id, problem2Id] } },
      });
    }
    if (user1Id) {
      await prisma.session.deleteMany({ where: { userId: user1Id } });
      await prisma.user.deleteMany({ where: { id: user1Id } });
    }
    if (user2Id) {
      await prisma.session.deleteMany({ where: { userId: user2Id } });
      await prisma.user.deleteMany({ where: { id: user2Id } });
    }
  });

  function createRequest(url: string, sessionToken?: string): NextRequest {
    const headers = new Headers();
    if (sessionToken) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    }
    return new NextRequest(url, { method: "GET", headers });
  }

  it("1. Returns 401 when unauthenticated", async () => {
    const req = createRequest("http://localhost:3000/api/submissions");
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(401);
  });

  it("2. User 1 retrieves only their own submissions with correct count & pagination", async () => {
    const req = createRequest(
      "http://localhost:3000/api/submissions?page=1&pageSize=10",
      user1SessionToken,
    );
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.pagination.total).toBe(3);
    expect(data.submissions.length).toBe(3);

    // Verify ordering: newest first (Problem 2 TS submission was created last)
    expect(data.submissions[0].language).toBe("TYPESCRIPT");
    expect(data.submissions[0].verdict).toBe("TIME_LIMIT_EXCEEDED");

    // Security Check: source code MUST NOT be exposed in list API
    data.submissions.forEach((sub: any) => {
      expect(sub.code).toBeUndefined();
    });
  });

  it("3. User 2 sees only their 1 submission (Ownership Isolation)", async () => {
    const req = createRequest(
      "http://localhost:3000/api/submissions",
      user2SessionToken,
    );
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.pagination.total).toBe(1);
    expect(data.submissions.length).toBe(1);
  });

  it("4. Filters by language correctly", async () => {
    const req = createRequest(
      "http://localhost:3000/api/submissions?language=PYTHON",
      user1SessionToken,
    );
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.pagination.total).toBe(1);
    expect(data.submissions[0].language).toBe("PYTHON");
    expect(data.submissions[0].verdict).toBe("ACCEPTED");
  });

  it("5. Filters by verdict correctly", async () => {
    const req = createRequest(
      "http://localhost:3000/api/submissions?verdict=WRONG_ANSWER",
      user1SessionToken,
    );
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.pagination.total).toBe(1);
    expect(data.submissions[0].verdict).toBe("WRONG_ANSWER");
    expect(data.submissions[0].language).toBe("CPP");
  });

  it("6. Rejects invalid language filter with 400", async () => {
    const req = createRequest(
      "http://localhost:3000/api/submissions?language=RUBY",
      user1SessionToken,
    );
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(400);
  });

  it("7. Rejects invalid verdict filter with 400", async () => {
    const req = createRequest(
      "http://localhost:3000/api/submissions?verdict=INVALID_VERDICT",
      user1SessionToken,
    );
    const res = await listSubmissionsHandler(req);
    expect(res.status).toBe(400);
  });
});
