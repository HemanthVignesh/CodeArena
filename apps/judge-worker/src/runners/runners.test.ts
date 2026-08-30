import { describe, it, expect } from "vitest";
import {
  Language,
  ExecutionStatus,
  DEFAULT_LIMITS,
  MVP_LANGUAGES,
} from "@codearena/judge-shared";
import { getRunner, SUPPORTED_LANGUAGES } from "../runners/index";
import { PythonRunner } from "../runners/python";
import { CppRunner } from "../runners/cpp";
import { TypeScriptRunner } from "../runners/typescript";
import { workerConfig } from "../config";

describe("CodeArena Judge Worker — Runner & Config Unit Tests", () => {
  // ── 1. Language selection ──────────────────────────────────────────────────

  it("1. getRunner(PYTHON) returns a PythonRunner", () => {
    const runner = getRunner(Language.PYTHON);
    expect(runner).toBeInstanceOf(PythonRunner);
    expect(runner.language).toBe(Language.PYTHON);
  });

  it("2. getRunner(CPP) returns a CppRunner", () => {
    const runner = getRunner(Language.CPP);
    expect(runner).toBeInstanceOf(CppRunner);
    expect(runner.language).toBe(Language.CPP);
  });

  it("3. getRunner(TYPESCRIPT) returns a TypeScriptRunner", () => {
    const runner = getRunner(Language.TYPESCRIPT);
    expect(runner).toBeInstanceOf(TypeScriptRunner);
    expect(runner.language).toBe(Language.TYPESCRIPT);
  });

  // ── 2. Invalid language rejection ─────────────────────────────────────────

  it("4. getRunner throws for an unsupported language (JAVA)", () => {
    expect(() => getRunner(Language.JAVA)).toThrow();
  });

  it("5. getRunner throws for an unsupported language (RUST)", () => {
    expect(() => getRunner(Language.RUST)).toThrow();
  });

  it("6. getRunner throws for an unsupported language (GO)", () => {
    expect(() => getRunner(Language.GO)).toThrow();
  });

  // ── 3. Python runner configuration ────────────────────────────────────────

  it("7. Python runner has no compile step (interpreted language)", () => {
    const runner = getRunner(Language.PYTHON);
    expect(runner.compileArgs).toBeNull();
    expect(runner.requiresCompile).toBe(false);
  });

  it("8. Python runner uses correct source filename", () => {
    const runner = getRunner(Language.PYTHON);
    expect(runner.sourceFilename).toBe("solution.py");
  });

  it("9. Python runner uses safe static run args (no user values)", () => {
    const runner = getRunner(Language.PYTHON);
    expect(runner.runArgs).toEqual(["python3", "/code/solution.py"]);
    // Ensure args are a static array — no string interpolation
    expect(runner.runArgs.every((a) => typeof a === "string")).toBe(true);
  });

  // ── 4. C++ runner configuration ───────────────────────────────────────────

  it("10. C++ runner requires a compile step", () => {
    const runner = getRunner(Language.CPP);
    expect(runner.compileArgs).not.toBeNull();
    expect(runner.requiresCompile).toBe(true);
  });

  it("11. C++ compile args include -std=c++20 flag", () => {
    const runner = getRunner(Language.CPP);
    expect(runner.compileArgs).toContain("-std=c++20");
  });

  it("12. C++ compile args target the correct source filename", () => {
    const runner = getRunner(Language.CPP);
    expect(runner.sourceFilename).toBe("solution.cpp");
    expect(runner.compileArgs).toContain("/code/solution.cpp");
  });

  it("13. C++ run args execute the compiled binary only", () => {
    const runner = getRunner(Language.CPP);
    expect(runner.runArgs).toEqual(["/code/solution"]);
  });

  // ── 5. TypeScript runner configuration ────────────────────────────────────

  it("14. TypeScript runner requires a compile step", () => {
    const runner = getRunner(Language.TYPESCRIPT);
    expect(runner.compileArgs).not.toBeNull();
    expect(runner.requiresCompile).toBe(true);
  });

  it("15. TypeScript compile args include tsc (not npx or eval)", () => {
    const runner = getRunner(Language.TYPESCRIPT);
    expect(runner.compileArgs![0]).toBe("tsc");
    // Must NOT use eval, new Function, or npx to execute user code
    expect(runner.compileArgs).not.toContain("eval");
    expect(runner.compileArgs).not.toContain("new Function");
  });

  it("16. TypeScript run args use node (not ts-node or eval)", () => {
    const runner = getRunner(Language.TYPESCRIPT);
    expect(runner.runArgs[0]).toBe("node");
    expect(runner.runArgs[1]).toBe("/code/solution.js");
    expect(runner.runArgs).not.toContain("ts-node");
    expect(runner.runArgs).not.toContain("eval");
  });

  // ── 6. Resource limits ────────────────────────────────────────────────────

  it("17. Python default time limit is reasonable (1000–5000ms)", () => {
    const limits = DEFAULT_LIMITS[Language.PYTHON];
    expect(limits.timeLimitMs).toBeGreaterThanOrEqual(1000);
    expect(limits.timeLimitMs).toBeLessThanOrEqual(5000);
  });

  it("18. C++ default time limit is tighter than Python (compiled advantage)", () => {
    const pyLimit = DEFAULT_LIMITS[Language.PYTHON].timeLimitMs;
    const cppLimit = DEFAULT_LIMITS[Language.CPP].timeLimitMs;
    expect(cppLimit).toBeLessThanOrEqual(pyLimit);
  });

  it("19. Memory limits are within safe bounds (64–512 MB)", () => {
    for (const lang of MVP_LANGUAGES) {
      const limits = DEFAULT_LIMITS[lang];
      expect(limits.memoryLimitMb).toBeGreaterThanOrEqual(64);
      expect(limits.memoryLimitMb).toBeLessThanOrEqual(512);
    }
  });

  // ── 7. Timeout / output limit configuration ───────────────────────────────

  it("20. Output limit is configured and non-zero", () => {
    expect(workerConfig.outputLimitBytes).toBeGreaterThan(0);
    expect(workerConfig.outputLimitBytes).toBeLessThanOrEqual(10 * 1024 * 1024); // max 10MB
  });

  it("21. PID limit is set and within safe range", () => {
    expect(workerConfig.pidLimit).toBeGreaterThan(0);
    expect(workerConfig.pidLimit).toBeLessThanOrEqual(256);
  });

  it("22. Container prefix is defined", () => {
    expect(workerConfig.containerPrefix).toBeTruthy();
    expect(typeof workerConfig.containerPrefix).toBe("string");
  });

  // ── 8. ExecutionStatus enum coverage ─────────────────────────────────────

  it("23. ExecutionStatus includes all required classification states", () => {
    expect(ExecutionStatus.SUCCESS).toBeDefined();
    expect(ExecutionStatus.COMPILATION_ERROR).toBeDefined();
    expect(ExecutionStatus.TIMEOUT).toBeDefined();
    expect(ExecutionStatus.MEMORY_LIMIT).toBeDefined();
    expect(ExecutionStatus.RUNTIME_ERROR).toBeDefined();
    expect(ExecutionStatus.OUTPUT_LIMIT).toBeDefined();
    expect(ExecutionStatus.INTERNAL_ERROR).toBeDefined();
  });

  // ── 9. SUPPORTED_LANGUAGES registry ──────────────────────────────────────

  it("24. SUPPORTED_LANGUAGES contains exactly Python, C++, TypeScript", () => {
    expect(SUPPORTED_LANGUAGES).toContain(Language.PYTHON);
    expect(SUPPORTED_LANGUAGES).toContain(Language.CPP);
    expect(SUPPORTED_LANGUAGES).toContain(Language.TYPESCRIPT);
    // JAVA, RUST, GO must NOT be in the MVP allowlist
    expect(SUPPORTED_LANGUAGES).not.toContain(Language.JAVA);
    expect(SUPPORTED_LANGUAGES).not.toContain(Language.RUST);
    expect(SUPPORTED_LANGUAGES).not.toContain(Language.GO);
  });
});
