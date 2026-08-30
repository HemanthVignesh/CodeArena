import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role, Language } from "@codearena/db";
import { GET as statusHandler } from "../app/api/submissions/[id]/status/route";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE_NAME, hashPassword } from "../lib/auth";

describe("CodeArena GET /api/submissions/:id/status Suite", () => {
  let user1Id: string;
  let user1SessionToken: string;
  let user2Id: string;
  let user2SessionToken: string;
  let problemId: string;
  let submission1Id: string;
  let submission2Id: string;

  beforeAll(async () => {
    const unique = Date.now();

    // User 1
    const user1 = await prisma.user.create({
      data: {
        email: `status_u1_${unique}@example.com`,
        username: `statusu1_${unique}`,
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
        email: `status_u2_${unique}@example.com`,
        username: `statusu2_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user2Id = user2.id;
    const session2 = await createSession(user2Id);
    user2SessionToken = session2.sessionToken;

    // Published Problem
    const problem = await prisma.problem.create({
      data: {
        slug: `status-problem-${unique}`,
        title: "Status Test Problem",
        statement: "Return 1",
        inputFormat: "none",
        outputFormat: "1",
        constraints: "none",
        isPublished: true,
      },
    });
    problemId = problem.id;

    // Submission 1 (belonging to user 1, COMPLETED ACCEPTED)
    const sub1 = await prisma.submission.create({
      data: {
        userId: user1Id,
        problemId,
        language: Language.PYTHON,
        code: "print(1)",
        status: "COMPLETED",
        verdict: "ACCEPTED",
        executionTimeMs: 45,
        memoryUsedKb: 12800,
        passedCases: 5,
        totalCases: 5,
      },
    });
    submission1Id = sub1.id;

    // Submission 2 (belonging to user 2, QUEUED)
    const sub2 = await prisma.submission.create({
      data: {
        userId: user2Id,
        problemId,
        language: Language.CPP,
        code: "int main(){}",
        status: "QUEUED",
      },
    });
    submission2Id = sub2.id;
  });

  afterAll(async () => {
    if (submission1Id || submission2Id) {
      await prisma.submission.deleteMany({
        where: { id: { in: [submission1Id, submission2Id] } },
      });
    }
    if (problemId) {
      await prisma.problem.deleteMany({ where: { id: problemId } });
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

  function createRequest(sessionToken?: string): NextRequest {
    const headers = new Headers();
    if (sessionToken) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    }
    return new NextRequest(
      "http://localhost:3000/api/submissions/mock/status",
      {
        method: "GET",
        headers,
      },
    );
  }

  it("1. Returns 401 when unauthenticated", async () => {
    const req = createRequest();
    const res = await statusHandler(req, { params: { id: submission1Id } });
    expect(res.status).toBe(401);
  });

  it("2. Returns 404 for non-existent submission ID", async () => {
    const req = createRequest(user1SessionToken);
    const res = await statusHandler(req, {
      params: { id: "non-existent-sub-id" },
    });
    expect(res.status).toBe(404);
  });

  it("3. Returns 404 when user attempts to access another user's submission (Ownership Isolation)", async () => {
    // User 1 requests status of User 2's submission
    const req = createRequest(user1SessionToken);
    const res = await statusHandler(req, { params: { id: submission2Id } });
    expect(res.status).toBe(404);
  });

  it("4. Returns safe status for QUEUED submission without premature metrics", async () => {
    const req = createRequest(user2SessionToken);
    const res = await statusHandler(req, { params: { id: submission2Id } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submission.id).toBe(submission2Id);
    expect(data.submission.status).toBe("QUEUED");
    expect(data.submission.verdict).toBeNull();
    expect(data.submission.runtimeMs).toBeNull();
    expect(data.submission.memoryKb).toBeNull();
    // Security check: source code must NEVER be returned
    expect(data.submission.code).toBeUndefined();
  });

  it("5. Returns finalized verdict and execution statistics for COMPLETED submission", async () => {
    const req = createRequest(user1SessionToken);
    const res = await statusHandler(req, { params: { id: submission1Id } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submission.id).toBe(submission1Id);
    expect(data.submission.status).toBe("COMPLETED");
    expect(data.submission.verdict).toBe("ACCEPTED");
    expect(data.submission.runtimeMs).toBe(45);
    expect(data.submission.memoryKb).toBe(12800);
    expect(data.submission.passedCases).toBe(5);
    expect(data.submission.totalCases).toBe(5);
    // Security check: source code must NEVER be returned
    expect(data.submission.code).toBeUndefined();
  });
});
