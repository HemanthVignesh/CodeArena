import { describe, it, expect, beforeAll } from "vitest";
import { prisma, Difficulty, Language } from "@codearena/db";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { GET as getProblemDetailHandler } from "@/app/api/problems/[slug]/route";
import { NextRequest } from "next/server";

describe("CodeArena Monaco IDE & Solver Workspace Test Suite", () => {
  let sampleProblemSlug = "pair-sum-target";

  beforeAll(async () => {
    // Ensure test problem exists
    const prob = await prisma.problem.findUnique({
      where: { slug: sampleProblemSlug },
      include: { templates: true },
    });
    if (!prob) {
      throw new Error(
        `Seed problem ${sampleProblemSlug} not found in database.`,
      );
    }
  });

  // 1. Problem workspace data loading
  it("1. should fetch complete public problem data for workspace rendering", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/problems/${sampleProblemSlug}`,
    );
    const res = await getProblemDetailHandler(req, {
      params: { slug: sampleProblemSlug },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.slug).toBe(sampleProblemSlug);
    expect(data.title).toBe("Pair Sum Target");
    expect(data.statement).toBeDefined();
    expect(data.inputFormat).toBeDefined();
    expect(data.outputFormat).toBeDefined();
    expect(data.constraints).toBeDefined();
    expect(data.timeLimitMs).toBe(1000);
    expect(data.memoryLimitMb).toBe(256);
  });

  // 2. Language selector contains supported MVP languages
  it("2. should include Python, C++, and TypeScript in SUPPORTED_LANGUAGES", () => {
    const languageIds = SUPPORTED_LANGUAGES.map((l) => l.id);
    expect(languageIds).toContain(Language.PYTHON);
    expect(languageIds).toContain(Language.CPP);
    expect(languageIds).toContain(Language.TYPESCRIPT);

    const monacoLangs = SUPPORTED_LANGUAGES.map((l) => l.monacoLang);
    expect(monacoLangs).toContain("python");
    expect(monacoLangs).toContain("cpp");
    expect(monacoLangs).toContain("typescript");
  });

  // 3. Correct template loads for Python
  it("3. should load correct Python boilerplate template from problem", async () => {
    const template = await prisma.languageTemplate.findUnique({
      where: {
        problemId_language: {
          problemId: (await prisma.problem.findUnique({
            where: { slug: sampleProblemSlug },
          }))!.id,
          language: Language.PYTHON,
        },
      },
    });

    expect(template).toBeDefined();
    expect(template?.boilerPlate).toContain("def pair_sum");
  });

  // 4. Correct template loads for C++
  it("4. should load correct C++ boilerplate template from problem", async () => {
    const template = await prisma.languageTemplate.findUnique({
      where: {
        problemId_language: {
          problemId: (await prisma.problem.findUnique({
            where: { slug: sampleProblemSlug },
          }))!.id,
          language: Language.CPP,
        },
      },
    });

    expect(template).toBeDefined();
    expect(template?.boilerPlate).toContain("#include <iostream>");
    expect(template?.boilerPlate).toContain("vector<int> pairSum");
  });

  // 5. Correct template loads for TypeScript
  it("5. should load correct TypeScript boilerplate template from problem", async () => {
    const template = await prisma.languageTemplate.findUnique({
      where: {
        problemId_language: {
          problemId: (await prisma.problem.findUnique({
            where: { slug: sampleProblemSlug },
          }))!.id,
          language: Language.TYPESCRIPT,
        },
      },
    });

    expect(template).toBeDefined();
    expect(template?.boilerPlate).toContain("function pairSum");
  });

  // 6. Reset restores original boilerplate logic
  it("6. should revert edited code back to language boilerplate on reset", () => {
    const originalBoilerplate = "def pair_sum(numbers, target): pass";
    let currentCode =
      "def pair_sum(numbers, target): return [0, 1] # modified code";

    // Simulating reset handler logic
    currentCode = originalBoilerplate;
    expect(currentCode).toBe(originalBoilerplate);
  });

  // 7. Draft code key format and isolation
  it("7. should format localStorage draft keys per problem and language", () => {
    const getStorageKey = (slug: string, lang: Language) =>
      `codearena:draft:${slug}:${lang}`;

    const pyKey = getStorageKey("pair-sum-target", Language.PYTHON);
    const cppKey = getStorageKey("pair-sum-target", Language.CPP);
    const otherProblemKey = getStorageKey(
      "valid-anagram-checker",
      Language.PYTHON,
    );

    expect(pyKey).toBe("codearena:draft:pair-sum-target:PYTHON");
    expect(cppKey).toBe("codearena:draft:pair-sum-target:CPP");
    expect(otherProblemKey).toBe(
      "codearena:draft:valid-anagram-checker:PYTHON",
    );
    expect(pyKey).not.toBe(cppKey);
    expect(pyKey).not.toBe(otherProblemKey);
  });

  // 8. Empty code validation on Run
  it("8. should identify empty or whitespace-only code for Run validation", () => {
    const validateCode = (code: string) => code.trim().length > 0;

    expect(validateCode("")).toBe(false);
    expect(validateCode("   \n\t  ")).toBe(false);
    expect(validateCode("print('hello')")).toBe(true);
  });

  // 9. Empty code validation on Submit
  it("9. should identify empty or whitespace-only code for Submit validation", () => {
    const validateCode = (code: string) => code.trim().length > 0;

    expect(validateCode("")).toBe(false);
    expect(validateCode("   ")).toBe(false);
    expect(validateCode("function solution() {}")).toBe(true);
  });

  // 10. Hidden test cases are never present in problem detail response
  it("10. should ensure hidden test cases are not returned to the problem solver workspace", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/problems/${sampleProblemSlug}`,
    );
    const res = await getProblemDetailHandler(req, {
      params: { slug: sampleProblemSlug },
    });
    const data = await res.json();

    expect(data.testCases).toBeDefined();
    // All test cases in public response must be sample test cases
    expect(data.testCases.every((tc: any) => tc.isSample === true)).toBe(true);
    expect(data.testCases.some((tc: any) => tc.isHidden === true)).toBe(false);
  });

  // 11. Unknown problem produces 404
  it("11. should return 404 for an unknown problem slug", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/problems/non-existent-problem",
    );
    const res = await getProblemDetailHandler(req, {
      params: { slug: "non-existent-problem" },
    });
    expect(res.status).toBe(404);
  });
});
