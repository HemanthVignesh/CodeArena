import { Language } from "@codearena/judge-shared";
import { LanguageRunner } from "./base";
import { PythonRunner } from "./python";
import { CppRunner } from "./cpp";
import { TypeScriptRunner } from "./typescript";

// Singleton instances — runners are stateless configs
const RUNNERS: Map<Language, LanguageRunner> = new Map([
  [Language.PYTHON, new PythonRunner()],
  [Language.CPP, new CppRunner()],
  [Language.TYPESCRIPT, new TypeScriptRunner()],
]);

/**
 * Returns the LanguageRunner for a given language.
 *
 * Enforces a strict allowlist: only MVP languages are accepted.
 * Any unknown or unsupported language throws immediately.
 *
 * @throws {Error} if the language is not in the MVP allowlist
 */
export function getRunner(language: Language): LanguageRunner {
  const runner = RUNNERS.get(language);
  if (!runner) {
    throw new Error(
      `Language '${language}' is not supported in this worker. ` +
        `Supported: ${Array.from(RUNNERS.keys()).join(", ")}`,
    );
  }
  return runner;
}

/** List of all supported MVP language IDs */
export const SUPPORTED_LANGUAGES = Array.from(RUNNERS.keys());

export { LanguageRunner };
