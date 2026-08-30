/**
 * Judge Worker — Standalone Execution Test Runner
 *
 * Run with: npx tsx src/test-runner.ts
 * from apps/judge-worker/
 *
 * Exercises the full execution pipeline without BullMQ.
 * Requires Docker running and sandbox images built.
 *
 * This script is for local development verification — NOT a CI test.
 */

import {
  Language,
  ExecutionStatus,
  ExecutionMode,
  DEFAULT_LIMITS,
  ExecutionRequest,
} from "@codearena/judge-shared";
import { getRunner } from "./runners/index";
import { ExecutionOrchestrator } from "./orchestrator";
import { execSync } from "child_process";

const orchestrator = new ExecutionOrchestrator();

let passed = 0;
let failed = 0;

function makeRequest(
  language: Language,
  sourceCode: string,
  stdin = "",
  overrides: Partial<ExecutionRequest> = {},
): ExecutionRequest {
  const limits = DEFAULT_LIMITS[language];
  return {
    jobId: `manual-${Date.now()}`,
    language,
    sourceCode,
    stdin,
    timeLimitMs: limits.timeLimitMs,
    memoryLimitMb: limits.memoryLimitMb,
    mode: ExecutionMode.RUN,
    ...overrides,
  };
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ FAIL: ${name}\n     → ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   CodeArena Judge — Execution Test Runner  ║");
  console.log("╚════════════════════════════════════════════╝\n");

  // ── PYTHON ──────────────────────────────────────────────────────────────────

  console.log("📦 Python 3.12");

  await test("Hello CodeArena (Python)", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, `print("Hello CodeArena")`);
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.SUCCESS,
      `Expected SUCCESS, got ${r.status}`,
    );
    assert(
      r.stdout.trim() === "Hello CodeArena",
      `Unexpected stdout: ${r.stdout}`,
    );
  });

  await test("Python stdin passthrough", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, `print(input())`, "hello stdin");
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.SUCCESS,
      `Expected SUCCESS, got ${r.status}`,
    );
    assert(r.stdout.trim() === "hello stdin", `Got: ${r.stdout}`);
  });

  await test("Python runtime error (raise)", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, `raise ValueError("boom")`);
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.RUNTIME_ERROR,
      `Expected RUNTIME_ERROR, got ${r.status}`,
    );
  });

  await test("Python infinite loop → TIMEOUT (2s)", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, `while True: pass`, "", {
      timeLimitMs: 2000,
    });
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.TIMEOUT,
      `Expected TIMEOUT, got ${r.status}`,
    );
  });

  await test("Python network access blocked", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(
      Language.PYTHON,
      `
import socket
try:
    socket.getaddrinfo("google.com", 80)
    print("NETWORK_AVAILABLE")
except Exception:
    print("NETWORK_BLOCKED")
`,
    );
    const r = await orchestrator.execute(req, runner);
    assert(
      !r.stdout.includes("NETWORK_AVAILABLE"),
      "Network should be blocked!",
    );
  });

  await test("Python filesystem write restricted (/etc)", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(
      Language.PYTHON,
      `
try:
    open('/etc/pwned', 'w').write('x')
    print("WRITE_OK")
except Exception:
    print("WRITE_BLOCKED")
`,
    );
    const r = await orchestrator.execute(req, runner);
    assert(!r.stdout.includes("WRITE_OK"), "Write to /etc should be blocked!");
  });

  await test("Python output limit exceeded → OUTPUT_LIMIT", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(
      Language.PYTHON,
      `
for i in range(20000):
    print("A" * 100)
`,
    );
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.OUTPUT_LIMIT,
      `Expected OUTPUT_LIMIT, got ${r.status}`,
    );
  });

  // ── C++ ─────────────────────────────────────────────────────────────────────

  console.log("\n📦 C++20 (GCC 13)");

  await test("Hello CodeArena (C++)", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(
      Language.CPP,
      `#include <iostream>\nint main() { std::cout << "Hello CodeArena" << std::endl; return 0; }`,
    );
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.SUCCESS,
      `Expected SUCCESS, got ${r.status}: ${r.stderr}`,
    );
    assert(r.stdout.trim() === "Hello CodeArena", `Got: ${r.stdout}`);
  });

  await test("C++ compilation error → COMPILATION_ERROR", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(Language.CPP, `int main( { INVALID SYNTAX`);
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.COMPILATION_ERROR,
      `Expected COMPILATION_ERROR, got ${r.status}`,
    );
    const output = r.compileOutput ?? r.stderr;
    assert(output.length > 0, "Compile output should contain error message");
  });

  await test("C++ infinite loop → TIMEOUT", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(
      Language.CPP,
      `int main() { while(true) {} return 0; }`,
      "",
      { timeLimitMs: 1000 },
    );
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.TIMEOUT,
      `Expected TIMEOUT, got ${r.status}`,
    );
  });

  // ── TypeScript ───────────────────────────────────────────────────────────────

  console.log("\n📦 TypeScript (Node.js 20)");

  await test("Hello CodeArena (TypeScript)", async () => {
    const runner = getRunner(Language.TYPESCRIPT);
    const req = makeRequest(
      Language.TYPESCRIPT,
      `console.log("Hello CodeArena");`,
    );
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.SUCCESS,
      `Expected SUCCESS, got ${r.status}: ${r.stderr} ${r.compileOutput}`,
    );
    assert(r.stdout.trim() === "Hello CodeArena", `Got: ${r.stdout}`);
  });

  await test("TypeScript type error → COMPILATION_ERROR", async () => {
    const runner = getRunner(Language.TYPESCRIPT);
    const req = makeRequest(
      Language.TYPESCRIPT,
      `const x: number = "not a number";`,
    );
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.COMPILATION_ERROR,
      `Expected COMPILATION_ERROR, got ${r.status}`,
    );
  });

  await test("TypeScript infinite loop → TIMEOUT", async () => {
    const runner = getRunner(Language.TYPESCRIPT);
    const req = makeRequest(Language.TYPESCRIPT, `while(true) {}`, "", {
      timeLimitMs: 2000,
    });
    const r = await orchestrator.execute(req, runner);
    assert(
      r.status === ExecutionStatus.TIMEOUT,
      `Expected TIMEOUT, got ${r.status}`,
    );
  });

  // ── Container cleanup verification ──────────────────────────────────────────

  console.log("\n🔍 Container Cleanup Verification");

  await test("No orphaned codearena-exec containers after all tests", async () => {
    const containers = execSync(
      'docker ps -a --format "{{.Names}}" | grep codearena-exec || true',
      { encoding: "utf8" },
    ).trim();
    assert(containers === "", `Orphaned containers found:\n${containers}`);
  });

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"─".repeat(50)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
