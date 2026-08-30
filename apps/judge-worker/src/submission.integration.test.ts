import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role, Language } from "@codearena/db";
import { Verdict } from "@codearena/judge-shared";
import { processSubmissionJob } from "./processor";
import { execSync } from "child_process";

describe("Judge Worker Submission Processing & Evaluation Suite", () => {
  let testUserId: string;
  let problemId: string;

  beforeAll(async () => {
    // 1. Create a test user
    const unique = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `worker_test_${unique}@example.com`,
        username: `workeruser${unique}`,
        passwordHash: "hash123",
        role: Role.USER,
      },
    });
    testUserId = user.id;

    // 2. Create a problem with sample and hidden test cases
    // Problem: Return sum of two integers (a + b)
    const problem = await prisma.problem.create({
      data: {
        slug: `worker-sum-problem-${unique}`,
        title: "Sum of Two Numbers (Worker Test)",
        statement: "Given two integers a and b, return their sum.",
        inputFormat: "a b",
        outputFormat: "sum",
        constraints: "1 <= a, b <= 1000",
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        isPublished: true,
        testCases: {
          create: [
            // Sample test case 1
            {
              inputData: "2 3\n",
              expectedOutput: "5\n",
              isSample: true,
              isHidden: false,
              orderIndex: 0,
            },
            // Sample test case 2
            {
              inputData: "10 20\n",
              expectedOutput: "30\n",
              isSample: true,
              isHidden: false,
              orderIndex: 1,
            },
            // Hidden test case 3
            {
              inputData: "100 200\n",
              expectedOutput: "300\n",
              isSample: false,
              isHidden: true,
              orderIndex: 2,
            },
          ],
        },
      },
    });
    problemId = problem.id;
  });

  afterAll(async () => {
    if (problemId) {
      await prisma.testCase.deleteMany({ where: { problemId } });
      await prisma.submission.deleteMany({ where: { problemId } });
      await prisma.problem.deleteMany({ where: { id: problemId } });
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  function getRunningJudgeContainers(): string {
    try {
      return execSync(
        'docker ps -a --format "{{.Names}}" | grep codearena-exec || true',
        { encoding: "utf8" },
      ).trim();
    } catch {
      return "";
    }
  }

  // ── 1. Python Correct Submission → ACCEPTED ────────────────────────────────

  it("1. Python correct submission passes all sample & hidden tests → ACCEPTED", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.PYTHON,
        code: `
import sys
line = sys.stdin.read().strip()
if line:
    a, b = map(int, line.split())
    print(a + b)
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.ACCEPTED);
    expect(res.passedCases).toBe(3);

    // Verify persisted record in PostgreSQL
    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.status).toBe("COMPLETED");
    expect(saved?.verdict).toBe(Verdict.ACCEPTED);
    expect(saved?.passedCases).toBe(3);
    expect(saved?.totalCases).toBe(3);
    expect(saved?.executionTimeMs).toBeGreaterThan(0);
  }, 45000);

  // ── 2. Python Wrong Answer → WRONG_ANSWER ──────────────────────────────────

  it("2. Python incorrect logic fails output comparison → WRONG_ANSWER", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.PYTHON,
        code: `
import sys
line = sys.stdin.read().strip()
if line:
    a, b = map(int, line.split())
    print(a * b) # Wrong: multiplication instead of addition
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.WRONG_ANSWER);
    expect(res.passedCases).toBe(0);

    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.status).toBe("COMPLETED");
    expect(saved?.verdict).toBe(Verdict.WRONG_ANSWER);
  }, 45000);

  // ── 3. Python Runtime Error → RUNTIME_ERROR ────────────────────────────────

  it("3. Python exception triggers RUNTIME_ERROR", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.PYTHON,
        code: `
a = 1 / 0 # ZeroDivisionError
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.RUNTIME_ERROR);

    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.status).toBe("COMPLETED");
    expect(saved?.verdict).toBe(Verdict.RUNTIME_ERROR);
    expect(saved?.errorMessage).toContain("ZeroDivisionError");
  }, 45000);

  // ── 4. Python Infinite Loop → TIME_LIMIT_EXCEEDED ──────────────────────────

  it("4. Python infinite loop triggers TIME_LIMIT_EXCEEDED", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.PYTHON,
        code: `
while True:
    pass
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.TIME_LIMIT_EXCEEDED);

    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.status).toBe("COMPLETED");
    expect(saved?.verdict).toBe(Verdict.TIME_LIMIT_EXCEEDED);
  }, 45000);

  // ── 5. C++ Correct Submission → ACCEPTED ───────────────────────────────────

  it("5. C++ correct submission compiles and runs → ACCEPTED", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.CPP,
        code: `
#include <iostream>
int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << (a + b) << std::endl;
    }
    return 0;
}
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.ACCEPTED);
    expect(res.passedCases).toBe(3);

    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.verdict).toBe(Verdict.ACCEPTED);
  }, 60000);

  // ── 6. C++ Compilation Failure → COMPILATION_ERROR ─────────────────────────

  it("6. C++ syntax error triggers COMPILATION_ERROR and halts execution", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.CPP,
        code: `
#include <iostream>
int main( { // Syntax error
    return 0;
}
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.COMPILATION_ERROR);

    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.status).toBe("COMPLETED");
    expect(saved?.verdict).toBe(Verdict.COMPILATION_ERROR);
    expect(saved?.compileOutput?.length).toBeGreaterThan(0);
  }, 60000);

  // ── 7. TypeScript Correct Submission → ACCEPTED ───────────────────────────

  it("7. TypeScript correct submission compiles via tsc and runs → ACCEPTED", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.TYPESCRIPT,
        code: `
declare const require: any;
const fs = require("fs");
const input: string = fs.readFileSync(0, "utf-8").trim();
if (input) {
  const [a, b]: number[] = input.split(/\\s+/).map(Number);
  console.log(a + b);
}
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.ACCEPTED);
    expect(res.passedCases).toBe(3);

    const saved = await prisma.submission.findUnique({
      where: { id: submission.id },
    });
    expect(saved?.verdict).toBe(Verdict.ACCEPTED);
  }, 60000);

  // ── 8. Hidden Test Failure ─────────────────────────────────────────────────

  it("8. Submission hardcoded for sample cases fails on hidden test → WRONG_ANSWER", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.PYTHON,
        code: `
import sys
line = sys.stdin.read().strip()
if line == "2 3":
    print(5)
elif line == "10 20":
    print(30)
else:
    print(0) # Fails on hidden test "100 200"
`,
        status: "QUEUED",
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.WRONG_ANSWER);
    // Passed the 2 sample cases, but failed the 3rd (hidden) case
    expect(res.passedCases).toBe(2);
  }, 45000);

  // ── 9. Idempotency ─────────────────────────────────────────────────────────

  it("9. Already finalized submission is safely skipped if re-delivered", async () => {
    const submission = await prisma.submission.create({
      data: {
        userId: testUserId,
        problemId,
        language: Language.PYTHON,
        code: "print(5)",
        status: "COMPLETED",
        verdict: "ACCEPTED",
        passedCases: 3,
        totalCases: 3,
      },
    });

    const res = await processSubmissionJob({
      submissionId: submission.id,
      problemId,
    });

    expect(res.verdict).toBe(Verdict.ACCEPTED);
    expect(res.passedCases).toBe(3);
  });

  // ── 10. Container Cleanup ──────────────────────────────────────────────────

  it("10. No orphaned codearena-exec containers remain after submission tests", () => {
    const containers = getRunningJudgeContainers();
    expect(containers).toBe("");
  });
});
