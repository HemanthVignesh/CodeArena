import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role, Language, Verdict } from "@codearena/db";
import { GET as getSubmissionDetailHandler } from "../app/api/submissions/[id]/route";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE_NAME, hashPassword } from "../lib/auth";

describe("CodeArena GET /api/submissions/:id Detail Suite", () => {
  let user1Id: string;
  let user1SessionToken: string;
  let user2Id: string;
  let user2SessionToken: string;
  let adminId: string;
  let adminSessionToken: string;
  let problemId: string;
  let user1SubId: string;

  beforeAll(async () => {
    const unique = Date.now();

    // User 1
    const user1 = await prisma.user.create({
      data: {
        email: `detail_u1_${unique}@example.com`,
        username: `detailu1_${unique}`,
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
        email: `detail_u2_${unique}@example.com`,
        username: `detailu2_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user2Id = user2.id;
    const session2 = await createSession(user2Id);
    user2SessionToken = session2.sessionToken;

    // Admin
    const admin = await prisma.user.create({
      data: {
        email: `detail_admin_${unique}@example.com`,
        username: `detailadmin_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;
    const sessionAdmin = await createSession(adminId);
    adminSessionToken = sessionAdmin.sessionToken;

    // Problem with hidden test case
    const problem = await prisma.problem.create({
      data: {
        slug: `detail-problem-${unique}`,
        title: "Detail Test Problem",
        statement: "Problem statement",
        inputFormat: "none",
        outputFormat: "none",
        constraints: "none",
        isPublished: true,
        testCases: {
          create: [
            {
              inputData: "SECRET_INPUT",
              expectedOutput: "SECRET_OUTPUT",
              isSample: false,
              isHidden: true,
            },
          ],
        },
      },
    });
    problemId = problem.id;

    // User 1 Submission
    const sub = await prisma.submission.create({
      data: {
        userId: user1Id,
        problemId,
        language: Language.PYTHON,
        code: "def solution():\n    return 42\n",
        status: "COMPLETED",
        verdict: Verdict.ACCEPTED,
        executionTimeMs: 55,
        memoryUsedKb: 13500,
        passedCases: 1,
        totalCases: 1,
      },
    });
    user1SubId = sub.id;
  });

  afterAll(async () => {
    if (problemId) {
      await prisma.testCase.deleteMany({ where: { problemId } });
      await prisma.submission.deleteMany({ where: { problemId } });
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
    if (adminId) {
      await prisma.session.deleteMany({ where: { userId: adminId } });
      await prisma.user.deleteMany({ where: { id: adminId } });
    }
  });

  function createRequest(sessionToken?: string): NextRequest {
    const headers = new Headers();
    if (sessionToken) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    }
    return new NextRequest("http://localhost:3000/api/submissions/mock", {
      method: "GET",
      headers,
    });
  }

  it("1. Returns 401 when unauthenticated", async () => {
    const req = createRequest();
    const res = await getSubmissionDetailHandler(req, {
      params: { id: user1SubId },
    });
    expect(res.status).toBe(401);
  });

  it("2. Returns 404 for non-existent submission ID", async () => {
    const req = createRequest(user1SessionToken);
    const res = await getSubmissionDetailHandler(req, {
      params: { id: "non-existent-sub-id" },
    });
    expect(res.status).toBe(404);
  });

  it("3. Owner can view own submission details INCLUDING source code", async () => {
    const req = createRequest(user1SessionToken);
    const res = await getSubmissionDetailHandler(req, {
      params: { id: user1SubId },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.submission.id).toBe(user1SubId);
    expect(data.submission.code).toBe("def solution():\n    return 42\n");
    expect(data.submission.verdict).toBe("ACCEPTED");
    expect(data.submission.runtimeMs).toBe(55);
    expect(data.submission.memoryKb).toBe(13500);
    expect(data.submission.problem.title).toBe("Detail Test Problem");

    // Security Check: Hidden test inputs/outputs must NEVER be in response
    expect(JSON.stringify(data)).not.toContain("SECRET_INPUT");
    expect(JSON.stringify(data)).not.toContain("SECRET_OUTPUT");
  });

  it("4. Non-owner (User 2) is forbidden (403) from viewing User 1's submission details", async () => {
    const req = createRequest(user2SessionToken);
    const res = await getSubmissionDetailHandler(req, {
      params: { id: user1SubId },
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });

  it("5. Admin can view User 1's submission details", async () => {
    const req = createRequest(adminSessionToken);
    const res = await getSubmissionDetailHandler(req, {
      params: { id: user1SubId },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submission.id).toBe(user1SubId);
  });
});
