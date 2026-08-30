import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role } from "@codearena/db";
import {
  ExecutionStatus,
  RunJobResult,
  Language,
} from "@codearena/judge-shared";
import { processRunJob } from "./run-processor";
import Redis from "ioredis";
import { workerConfig } from "./config";

describe("Judge Worker Run Job Processing Suite", () => {
  let testUserId: string;
  let problemId: string;
  let redisClient: Redis;

  beforeAll(async () => {
    redisClient = new Redis(workerConfig.redisUrl);

    const unique = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `run_worker_test_${unique}@example.com`,
        username: `runworker${unique}`,
        passwordHash: "hash123",
        role: Role.USER,
      },
    });
    testUserId = user.id;

    const problem = await prisma.problem.create({
      data: {
        slug: `run-worker-problem-${unique}`,
        title: "Run Worker Test Problem",
        statement: "Given two integers a and b, return their sum.",
        inputFormat: "a b",
        outputFormat: "sum",
        constraints: "1 <= a, b <= 1000",
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        isPublished: true,
      },
    });
    problemId = problem.id;
  });

  afterAll(async () => {
    if (problemId) {
      await prisma.problem.deleteMany({ where: { id: problemId } });
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await redisClient.quit();
  });

  it("1. Python run job executes custom stdin in Docker and writes result to Redis", async () => {
    const jobId = `test-py-run-${Date.now()}`;
    const code = `
import sys
data = sys.stdin.read().split()
if data:
    a, b = map(int, data)
    print(a + b)
`;
    await processRunJob(
      {
        jobId,
        problemId,
        language: Language.PYTHON,
        sourceCode: code,
        stdin: "40 2\n",
        userId: testUserId,
      },
      redisClient,
    );

    const raw = await redisClient.get(`run:result:${jobId}`);
    expect(raw).toBeTruthy();
    const result: RunJobResult = JSON.parse(raw!);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("42");
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  it("2. C++ run job compiles and executes custom stdin in Docker", async () => {
    const jobId = `test-cpp-run-${Date.now()}`;
    const code = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    if (cin >> a >> b) {
        cout << (a * b) << endl;
    }
    return 0;
}
`;
    await processRunJob(
      {
        jobId,
        problemId,
        language: Language.CPP,
        sourceCode: code,
        stdin: "6 7\n",
        userId: testUserId,
      },
      redisClient,
    );

    const raw = await redisClient.get(`run:result:${jobId}`);
    expect(raw).toBeTruthy();
    const result: RunJobResult = JSON.parse(raw!);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("42");
  });

  it("3. TypeScript run job compiles and executes custom stdin in Docker", async () => {
    const jobId = `test-ts-run-${Date.now()}`;
    const code = `
declare const require: any;
const fs = require("fs");
const input: string = fs.readFileSync(0, "utf-8").trim();
console.log("TS: " + input.toUpperCase());
`;
    await processRunJob(
      {
        jobId,
        problemId,
        language: Language.TYPESCRIPT,
        sourceCode: code,
        stdin: "hello typescript",
        userId: testUserId,
      },
      redisClient,
    );

    const raw = await redisClient.get(`run:result:${jobId}`);
    expect(raw).toBeTruthy();
    const result: RunJobResult = JSON.parse(raw!);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("TS: HELLO TYPESCRIPT");
  });

  it("4. Python runtime exception returns RUNTIME_ERROR status", async () => {
    const jobId = `test-py-err-${Date.now()}`;
    const code = `raise RuntimeError("Custom Error")`;
    await processRunJob(
      {
        jobId,
        problemId,
        language: Language.PYTHON,
        sourceCode: code,
        stdin: "",
        userId: testUserId,
      },
      redisClient,
    );

    const raw = await redisClient.get(`run:result:${jobId}`);
    expect(raw).toBeTruthy();
    const result: RunJobResult = JSON.parse(raw!);
    expect(result.status).toBe(ExecutionStatus.RUNTIME_ERROR);
    expect(result.stderr).toContain("RuntimeError");
  });

  it("5. C++ syntax error returns COMPILATION_ERROR status", async () => {
    const jobId = `test-cpp-ce-${Date.now()}`;
    const code = `invalid c++ syntax error`;
    await processRunJob(
      {
        jobId,
        problemId,
        language: Language.CPP,
        sourceCode: code,
        stdin: "",
        userId: testUserId,
      },
      redisClient,
    );

    const raw = await redisClient.get(`run:result:${jobId}`);
    expect(raw).toBeTruthy();
    const result: RunJobResult = JSON.parse(raw!);
    expect(result.status).toBe(ExecutionStatus.COMPILATION_ERROR);
  });
});
