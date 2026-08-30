import { ExecutionRequest, ExecutionResult } from "@codearena/judge-shared";
import { LanguageRunner } from "./runners/base";
import { DockerSandboxManager } from "./sandbox/docker";

const sandbox = new DockerSandboxManager();

/**
 * ExecutionOrchestrator
 *
 * Coordinates execution requests and delegates sandboxed execution
 * and cleanup to the DockerSandboxManager.
 */
export class ExecutionOrchestrator {
  async execute(
    request: ExecutionRequest,
    runner: LanguageRunner,
  ): Promise<ExecutionResult> {
    return sandbox.execute(request, runner);
  }
}
