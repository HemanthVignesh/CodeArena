import dotenv from "dotenv";
import path from "path";
import os from "os";

// Load root .env, then local .env (local overrides root)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

export const workerConfig = {
  // Infrastructure
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  databaseUrl: process.env.DATABASE_URL,
  queueName: "code-execution",
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Container naming
  containerPrefix: "codearena-exec",

  // Container resource limits
  cpuLimit: process.env.SANDBOX_CPU_LIMIT || "0.5",
  pidLimit: parseInt(process.env.SANDBOX_PID_LIMIT || "64", 10),
  sandboxTmpfsSize: process.env.SANDBOX_TMPFS_SIZE || "64m",

  // Output cap: 1 MB per stream (stdout or stderr)
  outputLimitBytes: parseInt(
    process.env.SANDBOX_OUTPUT_LIMIT_BYTES || String(1 * 1024 * 1024),
    10,
  ),

  // Base directory for temporary execution directories.
  // IMPORTANT: Must be under a path shared with Docker Desktop.
  // On macOS, Docker Desktop shares /Users by default. /tmp is a symlink to
  // /private/tmp which is NOT shared. Use a dir under $HOME instead.
  // On Linux, os.tmpdir() (/tmp) works fine.
  sandboxTempDir:
    process.env.SANDBOX_TEMP_DIR ||
    (process.platform === "darwin"
      ? path.join(os.homedir(), ".codearena-sandbox")
      : os.tmpdir()),
};

// Backwards-compatible alias — existing code uses `config`
export const config = workerConfig;
