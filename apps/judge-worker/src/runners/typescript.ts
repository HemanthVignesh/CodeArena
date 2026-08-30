import { Language } from "@codearena/judge-shared";
import { LanguageRunner, RunnerConfig } from "./base";

/**
 * TypeScript/Node.js 20 language runner.
 *
 * Execution flow:
 *   source code → solution.ts
 *     → tsc --strict --target ES2022 --module commonjs solution.ts  (compile)
 *     → node solution.js                                              (run)
 *     → stdin → stdout/stderr
 *
 * TypeScript compiler (tsc@5.4.5) is pre-installed in the Docker image
 * at image build time — NOT installed at submission time.
 *
 * SECURITY: compileArgs and runArgs are static literal string arrays.
 * eval() and new Function() are not used anywhere.
 */
export class TypeScriptRunner extends LanguageRunner {
  readonly config: RunnerConfig = {
    language: Language.TYPESCRIPT,
    dockerImage: "codearena-typescript:20",
    sourceFilename: "solution.ts",
    // Source is mounted at /code (read-only).
    // tsc compiles to /sandbox (writable tmpfs) via --outDir.
    compileArgs: [
      "tsc",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--skipLibCheck",
      "--outDir",
      "/code",
      "/code/solution.ts",
    ],
    runArgs: ["node", "/code/solution.js"],
  };
}
