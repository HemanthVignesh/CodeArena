import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role, Language, Verdict } from "@codearena/db";
import { GET as sseHandler } from "../app/api/submissions/[id]/events/route";
import { NextRequest } from "next/server";
import { createSession, SESSION_COOKIE_NAME, hashPassword } from "../lib/auth";
import { redis } from "../lib/redis";
import {
  getSubmissionEventChannel,
  SubmissionStatus,
  SubmissionEventPayload,
  SUBMISSION_SSE_EVENT_NAME,
} from "@codearena/judge-shared";

describe("CodeArena GET /api/submissions/:id/events SSE Suite", () => {
  let user1Id: string;
  let user1SessionToken: string;
  let user2Id: string;
  let user2SessionToken: string;
  let problemId: string;
  let queuedSubId: string;
  let completedSubId: string;

  beforeAll(async () => {
    const unique = Date.now();

    // User 1 (Owner)
    const user1 = await prisma.user.create({
      data: {
        email: `sse_u1_${unique}@example.com`,
        username: `sseu1_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user1Id = user1.id;
    const session1 = await createSession(user1Id);
    user1SessionToken = session1.sessionToken;

    // User 2 (Other User)
    const user2 = await prisma.user.create({
      data: {
        email: `sse_u2_${unique}@example.com`,
        username: `sseu2_${unique}`,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user2Id = user2.id;
    const session2 = await createSession(user2Id);
    user2SessionToken = session2.sessionToken;

    // Problem
    const problem = await prisma.problem.create({
      data: {
        slug: `sse-problem-${unique}`,
        title: "SSE Test Problem",
        statement: "Return 1",
        inputFormat: "none",
        outputFormat: "1",
        constraints: "none",
        isPublished: true,
      },
    });
    problemId = problem.id;

    // Queued Submission
    const queuedSub = await prisma.submission.create({
      data: {
        userId: user1Id,
        problemId,
        language: Language.PYTHON,
        code: "print(1)",
        status: "QUEUED",
      },
    });
    queuedSubId = queuedSub.id;

    // Completed Submission
    const completedSub = await prisma.submission.create({
      data: {
        userId: user1Id,
        problemId,
        language: Language.CPP,
        code: "int main(){}",
        status: "COMPLETED",
        verdict: Verdict.ACCEPTED,
        executionTimeMs: 42,
        memoryUsedKb: 12000,
        passedCases: 3,
        totalCases: 3,
      },
    });
    completedSubId = completedSub.id;
  });

  afterAll(async () => {
    if (queuedSubId || completedSubId) {
      await prisma.submission.deleteMany({
        where: { id: { in: [queuedSubId, completedSubId] } },
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
      "http://localhost:3000/api/submissions/mock/events",
      {
        method: "GET",
        headers,
      },
    );
  }

  it("1. Returns 401 when unauthenticated", async () => {
    const req = createRequest();
    const res = await sseHandler(req, { params: { id: queuedSubId } });
    expect(res.status).toBe(401);
  });

  it("2. Returns 404 for non-existent submission ID", async () => {
    const req = createRequest(user1SessionToken);
    const res = await sseHandler(req, {
      params: { id: "non-existent-sub-id" },
    });
    expect(res.status).toBe(404);
  });

  it("3. Returns 403 when user attempts to stream another user's submission", async () => {
    // User 2 connects to User 1's submission stream
    const req = createRequest(user2SessionToken);
    const res = await sseHandler(req, { params: { id: queuedSubId } });
    expect(res.status).toBe(403);
  });

  it("4. Completed submission immediately returns text/event-stream with final state and closes", async () => {
    const req = createRequest(user1SessionToken);
    const res = await sseHandler(req, { params: { id: completedSubId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // Read the stream
    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();

    const { value, done } = await reader!.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain(`event: ${SUBMISSION_SSE_EVENT_NAME}`);
    expect(text).toContain('"status":"COMPLETED"');
    expect(text).toContain('"verdict":"ACCEPTED"');
    expect(text).toContain('"runtimeMs":42');

    // Security check: source code must NEVER appear in SSE event stream
    expect(text).not.toContain("int main()");
  });

  it("5. Queued submission connects to SSE and receives initial QUEUED snapshot", async () => {
    const req = createRequest(user1SessionToken);
    const res = await sseHandler(req, { params: { id: queuedSubId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);

    expect(text).toContain(`event: ${SUBMISSION_SSE_EVENT_NAME}`);
    expect(text).toContain('"status":"QUEUED"');

    // Cancel stream
    await reader?.cancel();
  });
});
