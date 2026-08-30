import { Language } from "@codearena/judge-shared";
import { LanguageRunner, RunnerConfig } from "./base";

/**
 * C++20 (GCC 13) language runner.
 *
 * Execution flow:
 *   source code → solution.cpp
 *     → g++ -O2 -std=c++20 -o solution solution.cpp   (compile inside sandbox)
 *     → ./solution                                      (run inside sandbox)
 *     → stdin → stdout/stderr
 *
 * Compilation happens INSIDE the isolated Docker container.
 * The host never runs g++ or user C++ code directly.
 *
 * SECURITY: compileArgs is a static literal string array.
 * The source filename is a constant; user code is never in the command argv.
 */
export class CppRunner extends LanguageRunner {
  readonly config: RunnerConfig = {
    language: Language.CPP,
    dockerImage: "codearena-cpp:13",
    sourceFilename: "solution.cpp",
    // Source is mounted at /code (read-only).
    // Output binary goes to /sandbox (writable tmpfs).
    compileArgs: [
      "g++",
      "-O2",
      "-std=c++20",
      "-Wall",
      "-o",
      "/code/solution",
      "/code/solution.cpp",
    ],
    runArgs: ["/code/solution"],
  };
}
