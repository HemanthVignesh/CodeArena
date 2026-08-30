/**
 * CodeArena Shared Judge Types, Constants, and Output Utilities
 * packages/judge-shared/src/index.ts
 */

// ─── Queue Constants ──────────────────────────────────────────────────────────

export const EXECUTION_QUEUE_NAME = "code-execution";
export const MAX_SOURCE_CODE_BYTES = 64 * 1024; // 64 KB limit for submitted source code

/** Separate BullMQ queue for ephemeral Run jobs (no DB record needed) */
export const RUN_QUEUE_NAME = "code-run";

/** Maximum stdin accepted by the Run API (16 KB) */
export const MAX_STDIN_BYTES = 16 * 1024;

/** How long a run result lives in Redis before expiry (2 minutes) */
export const RUN_RESULT_TTL_SECONDS = 120;

// ─── Language Enum ────────────────────────────────────────────────────────────

export enum Language {
  PYTHON = "PYTHON",
  CPP = "CPP",
  TYPESCRIPT = "TYPESCRIPT",
  JAVASCRIPT = "JAVASCRIPT",
  JAVA = "JAVA",
  RUST = "RUST",
  GO = "GO",
}

/** MVP supported languages — strict allowlist */
export const MVP_LANGUAGES: Language[] = [
  Language.PYTHON,
  Language.CPP,
  Language.TYPESCRIPT,
];

// ─── Execution Mode ───────────────────────────────────────────────────────────

export enum ExecutionMode {
  /** Run against custom stdin / sample cases only */
  RUN = "RUN",
  /** Full submission evaluated against all hidden test cases */
  SUBMIT = "SUBMIT",
}

// ─── Execution Status ─────────────────────────────────────────────────────────
//
// Represents the outcome at the sandbox/execution layer.
// These map upward into platform Verdicts.

export enum ExecutionStatus {
  /** Program exited 0, stdout captured successfully */
  SUCCESS = "SUCCESS",
  /** Compiler exited non-zero (C++/TypeScript compile step) */
  COMPILATION_ERROR = "COMPILATION_ERROR",
  /** Hard wall-clock timeout hit; container killed */
  TIMEOUT = "TIMEOUT",
  /** Container OOM-killed or memory cgroup limit hit */
  MEMORY_LIMIT = "MEMORY_LIMIT",
  /** Program exited non-zero / received fatal signal */
  RUNTIME_ERROR = "RUNTIME_ERROR",
  /** stdout/stderr exceeded hard byte cap */
  OUTPUT_LIMIT = "OUTPUT_LIMIT",
  /** Docker/infrastructure failure; not a user code problem */
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// ─── Submission-level Verdict Enum ───────────────────────────────────────────
//
// Authoritative verdict evaluated against test cases.

export enum Verdict {
  ACCEPTED = "ACCEPTED",
  WRONG_ANSWER = "WRONG_ANSWER",
  TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED",
  MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
  COMPILATION_ERROR = "COMPILATION_ERROR",
  RUNTIME_ERROR = "RUNTIME_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// ─── Submission Status ────────────────────────────────────────────────────────

export enum SubmissionStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
}

// ─── Resource Limits ──────────────────────────────────────────────────────────

export interface ExecutionLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
}

export const DEFAULT_LIMITS: Record<Language, ExecutionLimits> = {
  [Language.PYTHON]: { timeLimitMs: 2000, memoryLimitMb: 256 },
  [Language.CPP]: { timeLimitMs: 1000, memoryLimitMb: 256 },
  [Language.TYPESCRIPT]: { timeLimitMs: 2000, memoryLimitMb: 256 },
  [Language.JAVASCRIPT]: { timeLimitMs: 2000, memoryLimitMb: 256 },
  [Language.JAVA]: { timeLimitMs: 2000, memoryLimitMb: 512 },
  [Language.RUST]: { timeLimitMs: 1000, memoryLimitMb: 256 },
  [Language.GO]: { timeLimitMs: 1000, memoryLimitMb: 256 },
};

// ─── Execution Request ────────────────────────────────────────────────────────

export interface ExecutionRequest {
  /** Unique identifier for this execution (maps to a BullMQ job ID) */
  jobId: string;
  /** Language from the strict allowlist */
  language: Language;
  /** Raw source code as submitted by the user */
  sourceCode: string;
  /** stdin to pipe into the program */
  stdin: string;
  /** Wall-clock time limit in milliseconds */
  timeLimitMs: number;
  /** Container memory cap in megabytes */
  memoryLimitMb: number;
  /** Execution mode: RUN (sample) or SUBMIT (judge) */
  mode: ExecutionMode;
}

// ─── Execution Result ─────────────────────────────────────────────────────────

export interface ExecutionResult {
  /** Outcome classification from the sandbox layer */
  status: ExecutionStatus;
  /** Captured stdout (may be truncated at output limit) */
  stdout: string;
  /** Captured stderr (may be truncated) */
  stderr: string;
  /** Compiler stderr, for compiled languages on compile failure */
  compileOutput?: string;
  /** Process exit code (0 = success, null = killed by signal/timeout) */
  exitCode: number | null;
  /** Wall-clock execution time in milliseconds */
  executionTimeMs: number;
  /** Peak memory usage in kilobytes (0 if unavailable) */
  memoryUsedKb: number;
  /** Unix signal that killed the process, if any */
  signal: string | null;
  /** Human-readable reason for INTERNAL_ERROR, for worker logs only */
  errorReason?: string;
}

// ─── BullMQ Job Payload ───────────────────────────────────────────────────────
//
// Payload enqueued by the Next.js API layer.
// Contains minimal references; worker fetches authoritative data from DB.

export interface SubmissionJobData {
  submissionId: string;
  problemId: string;
  userId?: string;
}

// ─── Run Job Payload ──────────────────────────────────────────────────────────
//
// Payload for ephemeral run jobs — no Submission DB record created.
// Worker fetches trusted limits from Problem record via problemId.

export interface RunJobData {
  /** Unique job ID — used to store/fetch result from Redis */
  jobId: string;
  /** Problem ID — worker fetches trusted timeLimitMs / memoryLimitMb from DB */
  problemId: string;
  /** User ID for audit logging only */
  userId?: string;
  /** Language from the strict MVP allowlist */
  language: Language;
  /** Raw source code as submitted by the user */
  sourceCode: string;
  /** Custom stdin provided by the user (max 16 KB) */
  stdin: string;
}

// ─── Run Job Result ───────────────────────────────────────────────────────────
//
// Stored in Redis at "run:result:{jobId}" with RUN_RESULT_TTL_SECONDS TTL.
// Contains only safe fields — no hidden test data, no expected outputs.

export interface RunJobResult {
  /** Outcome classification from the sandbox layer */
  status: ExecutionStatus;
  /** Captured stdout (may be truncated) */
  stdout: string;
  /** Captured stderr (may be truncated) */
  stderr: string;
  /** Compiler stderr, for compiled languages on compile failure */
  compileOutput?: string;
  /** Process exit code */
  exitCode: number | null;
  /** Wall-clock execution time in milliseconds */
  executionTimeMs: number;
  /** Peak memory usage in kilobytes (0 if unavailable) */
  memoryUsedKb: number;
  /** Unix signal that killed the process, if any */
  signal: string | null;
}

// ─── Test Case Result Payload ─────────────────────────────────────────────────

export interface TestCaseResultPayload {
  testCaseId?: string;
  orderIndex: number;
  status: Verdict;
  executionTimeMs: number;
  memoryUsedKb: number;
  stdout?: string;
  stderr?: string;
  actualOutput?: string;
}

// ─── Final Verdict Payload ────────────────────────────────────────────────────

export interface FinalVerdictPayload {
  submissionId: string;
  status: SubmissionStatus;
  verdict: Verdict;
  executionTimeMs: number;
  memoryUsedKb: number;
  passedCases: number;
  totalCases: number;
  compileOutput?: string;
  errorMessage?: string;
}

// ─── Real-Time SSE Submission Events ──────────────────────────────────────────

export const SUBMISSION_EVENT_CHANNEL_PREFIX = "submission:events:";
export const SUBMISSION_SSE_EVENT_NAME = "submission_status";

/** Helper to generate the Redis pub/sub channel for a submission */
export function getSubmissionEventChannel(submissionId: string): string {
  return `${SUBMISSION_EVENT_CHANNEL_PREFIX}${submissionId}`;
}

/**
 * Safe event payload emitted to Redis Pub/Sub and streamed via SSE.
 * Contains only public/safe status and metrics — NEVER source code or hidden tests.
 */
export interface SubmissionEventPayload {
  submissionId: string;
  status: SubmissionStatus;
  verdict: Verdict | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCases: number | null;
  totalCases: number | null;
  compileOutput?: string | null;
  errorMessage?: string | null;
}

// ─── Output Normalization & Comparison ────────────────────────────────────────

/**
 * Normalizes output strings for deterministic comparison:
 * 1. Converts CRLF (\r\n) and CR (\r) to standard LF (\n)
 * 2. Trims trailing whitespace on each individual line
 * 3. Trims leading and trailing whitespace/newlines across the entire text
 */
export function normalizeOutput(text: string): string {
  if (!text) return "";
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());

  // Remove leading empty lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * Compares actual stdout against expected output deterministically.
 */
export function compareOutput(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
