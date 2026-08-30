"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RunState =
  | "idle"
  | "submitting" // POST /api/run in flight
  | "polling" // waiting for Docker result
  | "done" // result received
  | "error"; // network/server error

export interface RunResult {
  executionStatus: string;
  stdout: string;
  stderr: string;
  compileOutput: string | null;
  exitCode: number | null;
  executionTimeMs: number;
  memoryUsedKb: number | null;
  signal: string | null;
  isSuccess: boolean;
  isCompilationError: boolean;
  isRuntimeError: boolean;
  isTimeout: boolean;
  isMemoryLimit: boolean;
  isOutputLimit: boolean;
  isInternalError: boolean;
}

export interface UseRunCodeReturn {
  state: RunState;
  result: RunResult | null;
  error: string | null;
  run: (params: {
    problemId: string;
    language: string;
    sourceCode: string;
    stdin: string;
  }) => void;
  reset: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 45; // 45 seconds max wait
const MAX_POLL_TIMEOUT_MSG =
  "Execution did not complete within the expected time. Please try again or check your code for infinite loops.";

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useRunCode
 *
 * Manages the full lifecycle of a Run Code request:
 * 1. POST /api/run → receive jobId
 * 2. Poll GET /api/run/:jobId every ~1s
 * 3. Return result when ready
 *
 * Prevents duplicate requests. Cleans up polling on unmount.
 * Does NOT reset editor state under any circumstances.
 */
export function useRunCode(): UseRunCodeReturn {
  const [state, setState] = useState<RunState>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const isRunningRef = useRef(false); // Prevent duplicate clicks
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollCountRef.current = 0;
    isRunningRef.current = false;
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setState("idle");
    setResult(null);
    setError(null);
  }, [stopPolling]);

  const run = useCallback(
    async ({
      problemId,
      language,
      sourceCode,
      stdin,
    }: {
      problemId: string;
      language: string;
      sourceCode: string;
      stdin: string;
    }) => {
      // Prevent duplicate concurrent runs
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      stopPolling();
      setState("submitting");
      setResult(null);
      setError(null);

      // 1. POST /api/run
      let jobId: string;
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemId, language, sourceCode, stdin }),
        });

        if (!mountedRef.current) {
          isRunningRef.current = false;
          return;
        }

        if (res.status === 401) {
          setState("error");
          setError("You must be logged in to run code.");
          isRunningRef.current = false;
          return;
        }

        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          setState("error");
          setError(
            `Rate limit exceeded. Please wait ${(data as any)?.retryAfterSeconds ?? 60} seconds.`,
          );
          isRunningRef.current = false;
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState("error");
          setError((data as any)?.error ?? "Failed to start execution.");
          isRunningRef.current = false;
          return;
        }

        const data = await res.json();
        jobId = data.jobId;
      } catch (err) {
        if (!mountedRef.current) {
          isRunningRef.current = false;
          return;
        }
        setState("error");
        setError("Network error. Please check your connection and try again.");
        isRunningRef.current = false;
        return;
      }

      // 2. Start polling for result
      setState("polling");
      pollCountRef.current = 0;

      pollIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current) {
          stopPolling();
          return;
        }

        pollCountRef.current += 1;

        // Max attempts exceeded
        if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setState("error");
          setError(MAX_POLL_TIMEOUT_MSG);
          return;
        }

        try {
          const pollRes = await fetch(`/api/run/${jobId}`);

          if (!mountedRef.current) {
            stopPolling();
            return;
          }

          if (!pollRes.ok) {
            if (pollRes.status === 404) {
              // 404 = job ID not found or route mismatch — fatal, stop immediately
              stopPolling();
              setState("error");
              setError("Run job not found. Please try again.");
              return;
            }
            // Other transient errors — keep polling unless we've exceeded max
            console.warn("[useRunCode] Poll error:", pollRes.status);
            return;
          }

          const pollData = await pollRes.json();

          if (pollData.status === "PENDING") {
            // Not ready yet — keep polling
            return;
          }

          if (pollData.status === "DONE" && pollData.result) {
            stopPolling();
            setResult(pollData.result as RunResult);
            setState("done");
            return;
          }
        } catch (pollErr) {
          // Network error during polling — keep trying unless max exceeded
          console.warn("[useRunCode] Poll network error:", pollErr);
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  return { state, result, error, run, reset };
}
