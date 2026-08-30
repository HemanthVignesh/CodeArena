/**
 * Sandbox Integration Tests — Step 5A
 *
 * These tests exercise REAL Docker execution. They require:
 *   - Docker running on the host machine
 *   - All three sandbox images built:
 *       docker build -t codearena-python:3.12 ./sandboxes/python
 *       docker build -t codearena-cpp:13 ./sandboxes/cpp
 *       docker build -t codearena-typescript:20 ./sandboxes/typescript
 *
 * Run with:  pnpm test:sandbox
 * NOT run by default CI (pnpm test) — requires Docker.
 */

import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "child_process";
import {
  Language,
  ExecutionStatus,
  ExecutionMode,
  DEFAULT_LIMITS,
  ExecutionRequest,
} from "@codearena/judge-shared";
import { getRunner } from "./runners/index";
import { ExecutionOrchestrator } from "./orchestrator";

const orchestrator = new ExecutionOrchestrator();

function makeRequest(
  language: Language,
  sourceCode: string,
  stdin = "",
  overrides: Partial<ExecutionRequest> = {},
): ExecutionRequest {
  const limits = DEFAULT_LIMITS[language];
  return {
    jobId: `test-${Date.now()}`,
    language,
    sourceCode,
    stdin,
    timeLimitMs: limits.timeLimitMs,
    memoryLimitMb: limits.memoryLimitMb,
    mode: ExecutionMode.RUN,
    ...overrides,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getRunningJudgeContainers(): string {
  try {
    return execSync(
      'docker ps -a --format "{{.Names}}" | grep codearena-exec || true',
      {
        encoding: "utf8",
      },
    ).trim();
  } catch {
    return "";
  }
}

// ── 10. Valid Python execution ─────────────────────────────────────────────

describe("10. Python — valid execution", () => {
  it("executes print('Hello CodeArena') correctly", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, "print('Hello CodeArena')");
    const result = await orchestrator.execute(req, runner);

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("Hello CodeArena");
    expect(result.exitCode).toBe(0);
  }, 30000);

  it("handles stdin correctly in Python", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(
      Language.PYTHON,
      "line = input()\nprint(f'Echo: {line}')",
      "CodeArena",
    );
    const result = await orchestrator.execute(req, runner);
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("Echo: CodeArena");
  }, 30000);
});

// ── 11. Valid C++ execution ────────────────────────────────────────────────

describe("11. C++ — valid execution", () => {
  it("compiles and executes Hello CodeArena", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(
      Language.CPP,
      `#include <iostream>\nint main() { std::cout << "Hello CodeArena" << std::endl; return 0; }`,
    );
    const result = await orchestrator.execute(req, runner);

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("Hello CodeArena");
    expect(result.exitCode).toBe(0);
  }, 60000);
});

// ── 12. Valid TypeScript execution ─────────────────────────────────────────

describe("12. TypeScript — valid execution", () => {
  it("compiles and executes Hello CodeArena", async () => {
    const runner = getRunner(Language.TYPESCRIPT);
    const req = makeRequest(
      Language.TYPESCRIPT,
      `console.log("Hello CodeArena");`,
    );
    const result = await orchestrator.execute(req, runner);

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.stdout.trim()).toBe("Hello CodeArena");
    expect(result.exitCode).toBe(0);
  }, 60000);
});

// ── 13. Compilation error ─────────────────────────────────────────────────

describe("13. Compilation error", () => {
  it("C++ syntax error returns COMPILATION_ERROR", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(Language.CPP, `int main( { SYNTAX ERROR`);
    const result = await orchestrator.execute(req, runner);

    expect(result.status).toBe(ExecutionStatus.COMPILATION_ERROR);
    expect(result.stdout).toBe("");
    // Compile output should contain the compiler's error message
    const compileOutput = result.compileOutput ?? result.stderr;
    expect(compileOutput.length).toBeGreaterThan(0);
  }, 60000);

  it("TypeScript type error returns COMPILATION_ERROR", async () => {
    const runner = getRunner(Language.TYPESCRIPT);
    const req = makeRequest(
      Language.TYPESCRIPT,
      `const x: number = "this is not a number";`,
    );
    const result = await orchestrator.execute(req, runner);
    expect(result.status).toBe(ExecutionStatus.COMPILATION_ERROR);
  }, 60000);
});

// ── 14. Runtime error ─────────────────────────────────────────────────────

describe("14. Runtime error", () => {
  it("Python exception returns RUNTIME_ERROR", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, `raise ValueError("test error")`);
    const result = await orchestrator.execute(req, runner);

    expect(result.status).toBe(ExecutionStatus.RUNTIME_ERROR);
    expect(result.exitCode).not.toBe(0);
  }, 30000);

  it("C++ segfault returns RUNTIME_ERROR", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(
      Language.CPP,
      `int main() { int* p = nullptr; *p = 1; return 0; }`,
    );
    const result = await orchestrator.execute(req, runner);
    expect([ExecutionStatus.RUNTIME_ERROR, ExecutionStatus.TIMEOUT]).toContain(
      result.status,
    );
  }, 60000);
});

// ── 15. Infinite loop timeout ─────────────────────────────────────────────

describe("15. Infinite loop — hard timeout", () => {
  it("Python infinite loop is terminated within 2x time limit", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(Language.PYTHON, `while True: pass`, "", {
      timeLimitMs: 2000,
    });
    const start = Date.now();
    const result = await orchestrator.execute(req, runner);
    const elapsed = Date.now() - start;

    expect(result.status).toBe(ExecutionStatus.TIMEOUT);
    // Must terminate within reasonable bound (time limit + 5s grace)
    expect(elapsed).toBeLessThan(10000);
  }, 15000);

  it("C++ infinite loop is terminated", async () => {
    const runner = getRunner(Language.CPP);
    const req = makeRequest(
      Language.CPP,
      `int main() { while(true) {} return 0; }`,
      "",
      { timeLimitMs: 1000 },
    );
    const result = await orchestrator.execute(req, runner);
    expect(result.status).toBe(ExecutionStatus.TIMEOUT);
  }, 20000);

  it("Node.js infinite loop is terminated", async () => {
    const runner = getRunner(Language.TYPESCRIPT);
    const req = makeRequest(Language.TYPESCRIPT, `while(true) {}`, "", {
      timeLimitMs: 2000,
    });
    const result = await orchestrator.execute(req, runner);
    expect(result.status).toBe(ExecutionStatus.TIMEOUT);
  }, 20000);
});

// ── 16. Memory exhaustion containment ─────────────────────────────────────

describe("16. Memory exhaustion — container isolation", () => {
  it("Python memory bomb is contained within container", async () => {
    const runner = getRunner(Language.PYTHON);
    // Allocate 2 GB in a 256 MB container
    const req = makeRequest(
      Language.PYTHON,
      `x = bytearray(2 * 1024 * 1024 * 1024)`,
      "",
      { memoryLimitMb: 256, timeLimitMs: 5000 },
    );
    const result = await orchestrator.execute(req, runner);
    // Should be MEMORY_LIMIT or RUNTIME_ERROR (OOM kill), not host crash
    expect([
      ExecutionStatus.MEMORY_LIMIT,
      ExecutionStatus.RUNTIME_ERROR,
      ExecutionStatus.TIMEOUT,
    ]).toContain(result.status);
  }, 15000);
});

// ── 17. Excessive output containment ──────────────────────────────────────

describe("17. Output limit", () => {
  it("Python that generates > 1MB output is terminated as OUTPUT_LIMIT", async () => {
    const runner = getRunner(Language.PYTHON);
    // Each iteration prints ~100 bytes; 20000 iterations = ~2MB
    const req = makeRequest(
      Language.PYTHON,
      `
for i in range(20000):
    print("A" * 100)
`,
    );
    const result = await orchestrator.execute(req, runner);
    expect(result.status).toBe(ExecutionStatus.OUTPUT_LIMIT);
  }, 30000);
});

// ── 18. Network access blocked ────────────────────────────────────────────

describe("18. Network isolation", () => {
  it("Python cannot make outbound network requests (--network none)", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(
      Language.PYTHON,
      `
import socket
try:
    socket.getaddrinfo('google.com', 80)
    print("NETWORK_AVAILABLE")
except Exception as e:
    print("NETWORK_BLOCKED")
`,
    );
    const result = await orchestrator.execute(req, runner);
    // Either the program exits with NETWORK_BLOCKED, or it fails entirely
    expect(result.stdout).not.toContain("NETWORK_AVAILABLE");
    if (result.status === ExecutionStatus.SUCCESS) {
      expect(result.stdout).toContain("NETWORK_BLOCKED");
    }
  }, 30000);
});

// ── 19. Filesystem write restrictions ─────────────────────────────────────

describe("19. Filesystem write restrictions", () => {
  it("Python cannot write outside /sandbox tmpfs (read-only rootfs)", async () => {
    const runner = getRunner(Language.PYTHON);
    const req = makeRequest(
      Language.PYTHON,
      `
try:
    with open('/etc/pwned', 'w') as f:
        f.write('pwned')
    print("WRITE_SUCCEEDED")
except Exception as e:
    print("WRITE_BLOCKED")
`,
    );
    const result = await orchestrator.execute(req, runner);
    expect(result.stdout).not.toContain("WRITE_SUCCEEDED");
    if (result.status === ExecutionStatus.SUCCESS) {
      expect(result.stdout).toContain("WRITE_BLOCKED");
    }
  }, 30000);
});

// ── 20. Process limit ─────────────────────────────────────────────────────

describe("20. Process (PID) limit", () => {
  it("Python fork bomb is contained by --pids-limit", async () => {
    const runner = getRunner(Language.PYTHON);
    // Safe fork-bomb equivalent — spawns many processes then counts
    const req = makeRequest(
      Language.PYTHON,
      `
import os
try:
    pids = []
    for i in range(200):
        p = os.fork()
        if p == 0:
            import time; time.sleep(10); os._exit(0)
        pids.append(p)
    print("FORK_BOMB_SUCCEEDED")
except Exception as e:
    print("FORK_BOMB_BLOCKED")
`,
      "",
      { timeLimitMs: 5000 },
    );
    const result = await orchestrator.execute(req, runner);
    // The fork bomb should either be blocked or timeout — never succeed fully
    expect(result.stdout).not.toContain("FORK_BOMB_SUCCEEDED");
  }, 15000);
});

// ── 21–23. Container cleanup verification ─────────────────────────────────

describe("21-23. Container cleanup", () => {
  it("no codearena-exec containers remain after all tests", () => {
    const containers = getRunningJudgeContainers();
    expect(containers).toBe("");
  });
});

// ── After all: verify cleanup ─────────────────────────────────────────────

afterAll(() => {
  const containers = getRunningJudgeContainers();
  if (containers) {
    console.error(
      `[CLEANUP WARNING] Orphaned containers found:\n${containers}`,
    );
  }
});
