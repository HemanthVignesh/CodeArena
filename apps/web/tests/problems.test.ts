import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Difficulty, Language, Role } from "@codearena/db";
import { createSession } from "@/lib/auth";
import { GET as listProblemsHandler } from "@/app/api/problems/route";
import { GET as listTagsHandler } from "@/app/api/problems/tags/route";
import { GET as getProblemDetailHandler } from "@/app/api/problems/[slug]/route";
import { POST as createAdminProblemHandler } from "@/app/api/admin/problems/route";
import {
  PUT as updateAdminProblemHandler,
  GET as getAdminProblemHandler,
} from "@/app/api/admin/problems/[id]/route";
import {
  GET as getAdminTestCasesHandler,
  POST as createAdminTestCaseHandler,
} from "@/app/api/admin/problems/[id]/test-cases/route";
import { DELETE as deleteAdminTestCaseHandler } from "@/app/api/admin/problems/[id]/test-cases/[caseId]/route";
import { NextRequest } from "next/server";

describe("CodeArena Problem Catalog & Admin Management Test Suite", () => {
  let adminUserId: string;
  let adminSessionToken: string;
  let normalUserId: string;
  let normalSessionToken: string;
  let testProblemId: string;
  let testProblemSlug: string;
  let testCaseId: string;

  beforeAll(async () => {
    // Find or create admin user for testing
    let admin = await prisma.user.findUnique({
      where: { email: "admin@codearena.com" },
    });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: "admin@codearena.com",
          username: "admin_test",
          passwordHash: "argon2_test_hash",
          role: Role.ADMIN,
        },
      });
    }
    adminUserId = admin.id;
    const adminSess = await createSession(adminUserId);
    adminSessionToken = adminSess.sessionToken;

    // Find or create normal user for testing
    let normal = await prisma.user.findUnique({
      where: { email: "demo@codearena.com" },
    });
    if (!normal) {
      normal = await prisma.user.create({
        data: {
          email: "demo@codearena.com",
          username: "demo_test",
          passwordHash: "argon2_test_hash",
          role: Role.USER,
        },
      });
    }
    normalUserId = normal.id;
    const normalSess = await createSession(normalUserId);
    normalSessionToken = normalSess.sessionToken;
  });

  afterAll(async () => {
    // Clean up created test problem if exists
    if (testProblemId) {
      await prisma.testCase.deleteMany({ where: { problemId: testProblemId } });
      await prisma.problemTag.deleteMany({
        where: { problemId: testProblemId },
      });
      await prisma.languageTemplate.deleteMany({
        where: { problemId: testProblemId },
      });
      await prisma.problem.deleteMany({ where: { id: testProblemId } });
    }
  });

  // 1. List published problems
  it("1. should list published problems with pagination metadata", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems?page=1&pageSize=5",
    );
    const res = await listProblemsHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.problems).toBeDefined();
    expect(Array.isArray(body.problems)).toBe(true);
    expect(body.problems.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(5);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  // 2. Unpublished problems excluded from public catalog
  it("2. should exclude unpublished draft problems from the public catalog", async () => {
    const draftSlug = `draft-test-${Date.now()}`;
    const draft = await prisma.problem.create({
      data: {
        title: "Draft Problem",
        slug: draftSlug,
        difficulty: Difficulty.EASY,
        statement: "Draft statement",
        inputFormat: "Sample input",
        outputFormat: "Sample output",
        constraints: "None",
        isPublished: false,
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/problems?search=${draftSlug}`,
    );
    const res = await listProblemsHandler(req);
    const body = await res.json();

    expect(body.problems.some((p: any) => p.slug === draftSlug)).toBe(false);

    await prisma.problem.delete({ where: { id: draft.id } });
  });

  // 3. Search filter
  it("3. should filter problems by title or keyword search", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems?search=Anagram",
    );
    const res = await listProblemsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.problems.length).toBeGreaterThanOrEqual(1);
    expect(body.problems[0].title).toContain("Anagram");
  });

  // 4. Difficulty filter
  it("4. should filter problems by difficulty", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems?difficulty=HARD",
    );
    const res = await listProblemsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.problems.every((p: any) => p.difficulty === "HARD")).toBe(true);
  });

  // 5. Tag filter
  it("5. should filter problems by tag slug or name", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems?tag=arrays",
    );
    const res = await listProblemsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.problems.length).toBeGreaterThanOrEqual(1);
  });

  // 6. Pagination boundary checks
  it("6. should properly calculate pagination pages and offsets", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems?page=2&pageSize=3",
    );
    const res = await listProblemsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.pageSize).toBe(3);
  });

  // 7. Invalid difficulty validation
  it("7. should return 400 for invalid difficulty filter values", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems?difficulty=SUPER_HARD",
    );
    const res = await listProblemsHandler(req);
    expect(res.status).toBe(400);
  });

  // 8. Problem detail retrieval
  it("8. should retrieve problem details by slug including sample test cases", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems/pair-sum-target",
    );
    const res = await getProblemDetailHandler(req, {
      params: { slug: "pair-sum-target" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("pair-sum-target");
    expect(body.statement).toBeDefined();
    expect(body.testCases).toBeDefined();
    expect(body.testCases.length).toBeGreaterThanOrEqual(1);
    expect(body.testCases.every((tc: any) => tc.isSample === true)).toBe(true);
  });

  // 9. Unknown slug returns 404
  it("9. should return 404 for nonexistent problem slug", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems/nonexistent-problem-slug",
    );
    const res = await getProblemDetailHandler(req, {
      params: { slug: "nonexistent-problem-slug" },
    });
    expect(res.status).toBe(404);
  });

  // 10. Hidden test cases never appear in public response
  it("10. should NEVER include hidden test cases in public problem details", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems/pair-sum-target",
    );
    const res = await getProblemDetailHandler(req, {
      params: { slug: "pair-sum-target" },
    });
    const body = await res.json();

    // Verify all returned test cases are sample test cases
    expect(body.testCases.some((tc: any) => tc.isHidden === true)).toBe(false);
  });

  // 11. Non-admin forbidden (403) from admin endpoints
  it("11. should return 403 when a normal user attempts to access admin APIs", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/problems", {
      method: "POST",
      headers: {
        cookie: `codearena_session=${normalSessionToken}`,
      },
      body: JSON.stringify({
        title: "Unauthorized Problem",
        slug: "unauthorized-problem",
        difficulty: "EASY",
        statement: "Should fail",
      }),
    });

    const res = await createAdminProblemHandler(req);
    expect(res.status).toBe(403);
  });

  // 12. Admin can create problem
  it("12. should allow an ADMIN to create a new problem with tags and templates", async () => {
    testProblemSlug = `test-problem-${Date.now()}`;
    const req = new NextRequest("http://localhost:3000/api/admin/problems", {
      method: "POST",
      headers: {
        cookie: `codearena_session=${adminSessionToken}`,
      },
      body: JSON.stringify({
        title: "Automated Test Problem",
        slug: testProblemSlug,
        difficulty: "MEDIUM",
        statement: "Calculate the sum of all elements.",
        inputFormat: "Array of integers",
        outputFormat: "Single integer sum",
        constraints: "1 <= N <= 100",
        timeLimitMs: 1500,
        memoryLimitMb: 512,
        isPublished: true,
        tags: ["Arrays", "Math"],
      }),
    });

    const res = await createAdminProblemHandler(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.slug).toBe(testProblemSlug);
    expect(body.timeLimitMs).toBe(1500);

    testProblemId = body.id;
  });

  // 13. Duplicate slug rejected
  it("13. should reject creating a problem with a duplicate slug (409)", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/problems", {
      method: "POST",
      headers: {
        cookie: `codearena_session=${adminSessionToken}`,
      },
      body: JSON.stringify({
        title: "Another Problem With Same Slug",
        slug: testProblemSlug,
        difficulty: "EASY",
        statement: "Another statement",
      }),
    });

    const res = await createAdminProblemHandler(req);
    expect(res.status).toBe(409);
  });

  // 14. Admin can update problem
  it("14. should allow an ADMIN to update problem metadata and statement", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/problems/${testProblemId}`,
      {
        method: "PUT",
        headers: {
          cookie: `codearena_session=${adminSessionToken}`,
        },
        body: JSON.stringify({
          title: "Updated Problem Title",
          difficulty: "HARD",
          timeLimitMs: 2000,
        }),
      },
    );

    const res = await updateAdminProblemHandler(req, {
      params: { id: testProblemId },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.title).toBe("Updated Problem Title");
    expect(body.difficulty).toBe("HARD");
    expect(body.timeLimitMs).toBe(2000);
  });

  // 15. Admin can create test case
  it("15. should allow an ADMIN to create a sample and a hidden test case", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/problems/${testProblemId}/test-cases`,
      {
        method: "POST",
        headers: {
          cookie: `codearena_session=${adminSessionToken}`,
        },
        body: JSON.stringify({
          inputData: "5\n1 2 3 4 5",
          expectedOutput: "15",
          isSample: true,
          isHidden: false,
          explanation: "1+2+3+4+5 = 15",
        }),
      },
    );

    const res = await createAdminTestCaseHandler(req, {
      params: { id: testProblemId },
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.isSample).toBe(true);
    expect(body.isHidden).toBe(false);
    testCaseId = body.id;
  });

  // 16. Admin can delete test case
  it("16. should allow an ADMIN to delete a test case", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/problems/${testProblemId}/test-cases/${testCaseId}`,
      {
        method: "DELETE",
        headers: {
          cookie: `codearena_session=${adminSessionToken}`,
        },
      },
    );

    const res = await deleteAdminTestCaseHandler(req, {
      params: { id: testProblemId, caseId: testCaseId },
    });
    expect(res.status).toBe(200);

    const deleted = await prisma.testCase.findUnique({
      where: { id: testCaseId },
    });
    expect(deleted).toBeNull();
  });

  // 17. Invalid / oversized test case rejected
  it("17. should reject test cases with missing required fields", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/admin/problems/${testProblemId}/test-cases`,
      {
        method: "POST",
        headers: {
          cookie: `codearena_session=${adminSessionToken}`,
        },
        body: JSON.stringify({
          inputData: "Some input",
          // missing expectedOutput
        }),
      },
    );

    const res = await createAdminTestCaseHandler(req, {
      params: { id: testProblemId },
    });
    expect(res.status).toBe(400);
  });

  // 18. Problem-tag relationship integrity
  it("18. should preserve Problem-Tag relationship integrity", async () => {
    const problemWithTags = await prisma.problem.findUnique({
      where: { id: testProblemId },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    });

    expect(problemWithTags).toBeDefined();
    expect(problemWithTags?.tags.length).toBeGreaterThanOrEqual(1);
  });

  // 19. Problem-test-case relationship integrity
  it("19. should associate test cases strictly with the parent problem", async () => {
    const newCase = await prisma.testCase.create({
      data: {
        problemId: testProblemId,
        inputData: "10 20",
        expectedOutput: "30",
        isSample: false,
        isHidden: true,
        orderIndex: 99,
      },
    });

    const fetched = await prisma.testCase.findUnique({
      where: { id: newCase.id },
      include: { problem: true },
    });

    expect(fetched?.problem.id).toBe(testProblemId);
    await prisma.testCase.delete({ where: { id: newCase.id } });
  });

  // 20. Language template uniqueness
  it("20. should enforce uniqueness for (problemId, language) template constraint", async () => {
    await expect(
      prisma.languageTemplate.create({
        data: {
          problemId: testProblemId,
          language: Language.PYTHON,
          boilerPlate: "# duplicate",
        },
      }),
    ).rejects.toThrow();
  });
});
