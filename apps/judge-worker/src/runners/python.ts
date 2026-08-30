import { Language } from "@codearena/judge-shared";
import { LanguageRunner, RunnerConfig } from "./base";

/**
 * Python 3.12 language runner.
 *
 * Execution flow:
 *   source code → solution.py → python3 solution.py → stdin → stdout/stderr
 *
 * No compile step. Interpreted directly by CPython 3.12.
 */
export class PythonRunner extends LanguageRunner {
  readonly config: RunnerConfig = {
    language: Language.PYTHON,
    dockerImage: "codearena-python:3.12",
    sourceFilename: "solution.py",
    compileArgs: null, // no compile step for Python
    // Source is mounted at /code; working dir is writable /sandbox tmpfs
    runArgs: ["python3", "/code/solution.py"],
  };
}
