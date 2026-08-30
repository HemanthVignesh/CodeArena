/**
 * Abstract base class for all language execution runners.
 *
 * Each runner defines the static, trusted configuration for a language:
 * - which Docker image to use
 * - what filename to write the source code to
 * - how to compile (if applicable) using a fixed, allowlisted command array
 * - how to run the compiled/interpreted binary
 *
 * SECURITY: compile and run args are static string arrays.
 * User-controlled values (source code, stdin) are NEVER interpolated
 * into these arrays. Source code is written to a temp file and bind-mounted.
 */

import { Language } from "@codearena/judge-shared";

export interface RunnerConfig {
  /** Language this runner handles */
  language: Language;
  /** Docker image name (must be pre-built and locally available) */
  dockerImage: string;
  /** Filename to write the user's source code to inside the container */
  sourceFilename: string;
  /**
   * Compile-step argv (excluding the executable).
   * null means interpreted language — no compile step.
   * MUST be a static literal array. No user values here.
   */
  compileArgs: string[] | null;
  /**
   * Run-step argv: the program and its fixed arguments.
   * MUST be a static literal array. Stdin is piped, never passed as an arg.
   */
  runArgs: string[];
}

export abstract class LanguageRunner {
  abstract readonly config: RunnerConfig;

  get language(): Language {
    return this.config.language;
  }

  get dockerImage(): string {
    return this.config.dockerImage;
  }

  get sourceFilename(): string {
    return this.config.sourceFilename;
  }

  get compileArgs(): string[] | null {
    return this.config.compileArgs;
  }

  get runArgs(): string[] {
    return this.config.runArgs;
  }

  get requiresCompile(): boolean {
    return this.config.compileArgs !== null;
  }
}
