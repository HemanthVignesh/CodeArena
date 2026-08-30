import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import {
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
} from "@codearena/judge-shared";
import { LanguageRunner } from "../runners/base";
import { workerConfig } from "../config";
import { ensureContainerRemoved } from "./cleanup";

/**
 * Runs a single execution phase (compile or run) inside a Docker container.
 *
 * SECURITY guarantees:
 * - All docker args are static string arrays. No shell interpolation.
 * - Source code is written to a temp dir on the host and bind-mounted.
 * - During compile: /code is mounted read-write (:rw) so compiler can output binary/js.
 * - During run: /code is mounted read-only (:ro) so user code CANNOT modify binaries or sources.
 * - The container root filesystem is read-only.
 * - A dedicated tmpfs at /sandbox is the only writable runtime location (uid=1001, mode=0700).
 * - Network is completely disabled (--network=none).
 * - The process runs as non-root (UID 1001, user "sandbox").
 * - All Linux capabilities are dropped (--cap-drop=ALL).
 * - no-new-privileges prevents privilege escalation via setuid binaries.
 * - PID limit prevents fork-bomb attacks.
 * - Memory limit (with swap disabled) prevents unbounded allocation.
 * - CPU quota limits compute abuse.
 * - stdout/stderr are hard-capped to OUTPUT_LIMIT_BYTES before classification.
 */
export async function runInContainer(
  containerName: string,
  dockerImage: string,
  hostSourceDir: string,
  argv: string[],
  stdin: string,
  timeLimitMs: number,
  memoryLimitMb: number,
  mountMode: "ro" | "rw" = "ro",
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  executionTimeMs: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}> {
  const startTime = Date.now();
  const outputLimitBytes = workerConfig.outputLimitBytes;

  // Docker invocation — all args are static string arrays.
  // NEVER use shell: true or template strings containing user values.
  const dockerArgs = [
    "run",
    "--rm",
    "-i",
    `--name=${containerName}`,

    // Network isolation
    "--network=none",

    // Filesystem security:
    //   Root FS is read-only.
    //   /sandbox is a writable tmpfs (compile output, temp files) owned by sandbox user (uid 1001).
    //   /tmp is an isolated temporary tmpfs.
    "--read-only",
    `--tmpfs=/sandbox:rw,exec,nosuid,size=${workerConfig.sandboxTmpfsSize},uid=1001,gid=1001,mode=0700`,
    `--tmpfs=/tmp:rw,noexec,nosuid,size=16m,uid=1001,gid=1001,mode=1777`,

    // Linux capability hardening
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges:true",

    // Resource limits
    `--memory=${memoryLimitMb}m`,
    `--memory-swap=${memoryLimitMb}m`, // disable swap
    `--cpus=${workerConfig.cpuLimit}`,
    `--pids-limit=${workerConfig.pidLimit}`,

    // Non-root user
    "--user=sandbox",

    // Working directory: the writable tmpfs (/sandbox)
    "--workdir=/sandbox",

    // Source files mounted at /code (:rw during compile, :ro during run)
    `--volume=${hostSourceDir}:/code:${mountMode}`,

    // Image and command
    dockerImage,
    ...argv,
  ];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let outputLimitExceeded = false;
    let timedOut = false;
    let settled = false;

    const proc = spawn("docker", dockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Hard timeout watchdog — kills container even if process hangs
    const timeoutHandle = setTimeout(async () => {
      if (settled) return;
      timedOut = true;
      try {
        const killer = spawn("docker", ["kill", containerName], {
          stdio: "ignore",
        });
        killer.unref();
      } catch {
        // best-effort
      }
      proc.kill("SIGKILL");
    }, timeLimitMs + 2000); // +2s grace for Docker startup overhead

    // Capture stdout with hard byte cap
    proc.stdout.on("data", (chunk: Buffer) => {
      if (outputLimitExceeded) return;
      const remaining = outputLimitBytes - Buffer.byteLength(stdout, "utf8");
      if (remaining <= 0) {
        outputLimitExceeded = true;
        proc.kill("SIGKILL");
        return;
      }
      stdout += chunk.slice(0, remaining).toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") >= outputLimitBytes) {
        outputLimitExceeded = true;
        proc.kill("SIGKILL");
      }
    });

    // Capture stderr with hard byte cap
    proc.stderr.on("data", (chunk: Buffer) => {
      const remaining = outputLimitBytes - Buffer.byteLength(stderr, "utf8");
      if (remaining <= 0) return;
      stderr += chunk.slice(0, remaining).toString("utf8");
    });

    // Pipe stdin safely — never interpolated into argv
    if (proc.stdin) {
      proc.stdin.write(stdin, "utf8", () => {
        proc.stdin?.end();
      });
    }

    proc.on("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      const executionTimeMs = Date.now() - startTime;
      resolve({
        stdout,
        stderr,
        exitCode,
        signal: signal ?? null,
        executionTimeMs,
        timedOut,
        outputLimitExceeded,
      });
    });

    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve({
        stdout,
        stderr: err.message,
        exitCode: null,
        signal: null,
        executionTimeMs: Date.now() - startTime,
        timedOut: false,
        outputLimitExceeded: false,
      });
    });
  });
}

/**
 * DockerSandboxManager — High-level execution API.
 *
 * Handles complete lifecycle:
 * 1. Creating a temporary host directory for the execution
 * 2. Compiling inside a compile container (if required)
 * 3. Executing inside a read-only isolated run container
 * 4. Classifying the result into ExecutionStatus
 * 5. Cleaning up all temp directories and containers in `finally`
 */
export class DockerSandboxManager {
  async execute(
    request: ExecutionRequest,
    runner: LanguageRunner,
  ): Promise<ExecutionResult> {
    const compileContainerName = `${workerConfig.containerPrefix}-${request.jobId}-compile-${randomUUID().slice(0, 8)}`;
    const runContainerName = `${workerConfig.containerPrefix}-${request.jobId}-run-${randomUUID().slice(0, 8)}`;
    let tempDir: string | null = null;

    try {
      // 1. Ensure base temp directory exists (under homedir for macOS Docker file sharing)
      await fs.mkdir(workerConfig.sandboxTempDir, { recursive: true });
      tempDir = await fs.mkdtemp(
        path.join(workerConfig.sandboxTempDir, "codearena-"),
      );

      // Give full permissions to temp directory so non-root container user (uid 1001) can write output
      await fs.chmod(tempDir, 0o777);

      // 2. Write source file
      const sourceFile = path.join(tempDir, runner.sourceFilename);
      await fs.writeFile(sourceFile, request.sourceCode, "utf8");

      let compileOutput: string | undefined;

      // 3. Optional Compilation Phase
      if (runner.requiresCompile) {
        const compileTimeLimit = Math.max(request.timeLimitMs, 10000); // 10s compile watchdog
        const compileRaw = await runInContainer(
          compileContainerName,
          runner.dockerImage,
          tempDir,
          runner.compileArgs!,
          "",
          compileTimeLimit,
          request.memoryLimitMb,
          "rw", // read-write so compiler can output binary
        );

        if (compileRaw.timedOut) {
          return {
            status: ExecutionStatus.TIMEOUT,
            stdout: "",
            stderr: "Compilation timed out.",
            compileOutput: "Compilation timed out.",
            exitCode: null,
            executionTimeMs: compileRaw.executionTimeMs,
            memoryUsedKb: 0,
            signal: null,
          };
        }

        if (compileRaw.exitCode !== 0) {
          return {
            status: ExecutionStatus.COMPILATION_ERROR,
            stdout: "",
            stderr: compileRaw.stderr || compileRaw.stdout,
            compileOutput: compileRaw.stderr || compileRaw.stdout,
            exitCode: compileRaw.exitCode,
            executionTimeMs: compileRaw.executionTimeMs,
            memoryUsedKb: 0,
            signal: compileRaw.signal,
          };
        }

        compileOutput = compileRaw.stderr || compileRaw.stdout;
      }

      // 4. Execution Phase (always read-only for /code)
      const raw = await runInContainer(
        runContainerName,
        runner.dockerImage,
        tempDir,
        runner.runArgs,
        request.stdin,
        request.timeLimitMs,
        request.memoryLimitMb,
        "ro", // read-only during execution
      );

      // 5. Classify the result
      let status: ExecutionStatus;

      if (raw.outputLimitExceeded) {
        status = ExecutionStatus.OUTPUT_LIMIT;
      } else if (raw.timedOut) {
        status = ExecutionStatus.TIMEOUT;
      } else if (raw.signal === "SIGKILL" || raw.signal === "SIGTERM") {
        if (raw.exitCode === 137) {
          status = ExecutionStatus.MEMORY_LIMIT;
        } else {
          status = ExecutionStatus.TIMEOUT;
        }
      } else if (raw.exitCode === 0) {
        status = ExecutionStatus.SUCCESS;
      } else {
        status = ExecutionStatus.RUNTIME_ERROR;
      }

      return {
        status,
        stdout: raw.stdout,
        stderr: raw.stderr,
        compileOutput,
        exitCode: raw.exitCode,
        executionTimeMs: raw.executionTimeMs,
        memoryUsedKb: 0,
        signal: raw.signal,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: ExecutionStatus.INTERNAL_ERROR,
        stdout: "",
        stderr: "",
        exitCode: null,
        executionTimeMs: 0,
        memoryUsedKb: 0,
        signal: null,
        errorReason: message,
      };
    } finally {
      // Guaranteed cleanup of temp dir and both container names
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
      await Promise.allSettled([
        ensureContainerRemoved(compileContainerName),
        ensureContainerRemoved(runContainerName),
      ]);
    }
  }
}
