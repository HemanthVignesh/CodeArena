"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SUBMISSION_SSE_EVENT_NAME } from "@codearena/judge-shared";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubmitState =
  | "idle"
  | "submitting" // POST /api/submissions in flight
  | "queued" // job in BullMQ queue (waiting for judge)
  | "running" // judge worker processing in Docker
  | "completed" // final verdict received
  | "error"; // network/server error

export interface SubmissionStatus {
  id: string;
  status: string;
  verdict: string | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCases: number | null;
  totalCases: number | null;
  compileOutput: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface UseSubmitCodeReturn {
  state: SubmitState;
  submission: SubmissionStatus | null;
  error: string | null;
  submit: (params: {
    problemId: string;
    language: string;
    sourceCode: string;
  }) => void;
  reset: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 45;
const TIMEOUT_MSG =
  "Submission is taking longer than expected. You can check your submission history.";

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useSubmitCode
 *
 * Manages the real-time lifecycle of a Submit Code request:
 * 1. POST /api/submissions → receive submissionId
 * 2. Connect to SSE stream at /api/submissions/:id/events
 * 3. Receive real-time server events (QUEUED → RUNNING → COMPLETED)
 * 4. Automatic fallback to polling /api/submissions/:id/status if SSE is unavailable or drops
 *
 * Prevents duplicate clicks. Automatically cleans up EventSource and timers on unmount.
 * NEVER clears or resets editor code state on completion or failure.
 */
export function useSubmitCode(): UseSubmitCodeReturn {
  const [state, setState] = useState<SubmitState>("idle");
  const [submission, setSubmission] = useState<SubmissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupStreamAndPolling();
    };
  }, []);

  const cleanupStreamAndPolling = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollCountRef.current = 0;
    isSubmittingRef.current = false;
  }, []);

  const reset = useCallback(() => {
    cleanupStreamAndPolling();
    setState("idle");
    setSubmission(null);
    setError(null);
  }, [cleanupStreamAndPolling]);

  // Fallback Polling Handler (used only if SSE fails)
  const startFallbackPolling = useCallback(
    (submissionId: string) => {
      if (pollIntervalRef.current) return;
      pollCountRef.current = 0;

      pollIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current) {
          cleanupStreamAndPolling();
          return;
        }

        pollCountRef.current += 1;
        if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
          cleanupStreamAndPolling();
          setState("error");
          setError(TIMEOUT_MSG);
          return;
        }

        try {
          const pollRes = await fetch(
            `/api/submissions/${submissionId}/status`,
          );
          if (!mountedRef.current || !pollRes.ok) return;

          const pollData = await pollRes.json();
          const sub = pollData.submission as SubmissionStatus;
          if (!sub) return;

          setSubmission(sub);
          if (sub.status === "RUNNING") {
            setState("running");
          } else if (sub.status === "QUEUED") {
            setState("queued");
          } else if (sub.status === "COMPLETED") {
            cleanupStreamAndPolling();
            setState("completed");
          }
        } catch {
          // Keep polling until timeout
        }
      }, POLL_INTERVAL_MS);
    },
    [cleanupStreamAndPolling],
  );

  const submit = useCallback(
    async ({
      problemId,
      language,
      sourceCode,
    }: {
      problemId: string;
      language: string;
      sourceCode: string;
    }) => {
      // Prevent duplicate in-flight submissions
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      cleanupStreamAndPolling();
      setState("submitting");
      setSubmission(null);
      setError(null);

      let submissionId: string;

      // 1. POST /api/submissions
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemId, language, sourceCode }),
        });

        if (!mountedRef.current) {
          isSubmittingRef.current = false;
          return;
        }

        if (res.status === 401) {
          setState("error");
          setError("You must be logged in to submit code.");
          isSubmittingRef.current = false;
          return;
        }

        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          setState("error");
          setError(
            `Rate limit exceeded. Please wait ${(data as any)?.retryAfterSeconds ?? 60} seconds.`,
          );
          isSubmittingRef.current = false;
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState("error");
          setError((data as any)?.error ?? "Failed to create submission.");
          isSubmittingRef.current = false;
          return;
        }

        const data = await res.json();
        submissionId = data.submission?.id;

        if (!submissionId) {
          setState("error");
          setError("Invalid response from server.");
          isSubmittingRef.current = false;
          return;
        }
      } catch {
        if (!mountedRef.current) {
          isSubmittingRef.current = false;
          return;
        }
        setState("error");
        setError("Network error. Please check your connection and try again.");
        isSubmittingRef.current = false;
        return;
      }

      // Initial state: QUEUED
      setState("queued");
      setSubmission({
        id: submissionId,
        status: "QUEUED",
        verdict: null,
        runtimeMs: null,
        memoryKb: null,
        passedCases: null,
        totalCases: null,
        compileOutput: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
      });

      // 2. Connect to SSE Stream
      try {
        const eventsUrl = `/api/submissions/${submissionId}/events`;
        const es = new EventSource(eventsUrl);
        eventSourceRef.current = es;

        es.addEventListener(
          SUBMISSION_SSE_EVENT_NAME,
          (event: MessageEvent) => {
            if (!mountedRef.current) return;

            try {
              const data = JSON.parse(event.data);
              if (!data || !data.status) return;

              setSubmission((prev) => ({
                id: submissionId,
                status: data.status,
                verdict: data.verdict ?? prev?.verdict ?? null,
                runtimeMs: data.runtimeMs ?? prev?.runtimeMs ?? null,
                memoryKb: data.memoryKb ?? prev?.memoryKb ?? null,
                passedCases: data.passedCases ?? prev?.passedCases ?? null,
                totalCases: data.totalCases ?? prev?.totalCases ?? null,
                compileOutput:
                  data.compileOutput ?? prev?.compileOutput ?? null,
                errorMessage: data.errorMessage ?? prev?.errorMessage ?? null,
                createdAt: prev?.createdAt || new Date().toISOString(),
              }));

              if (data.status === "RUNNING") {
                setState("running");
              } else if (data.status === "QUEUED") {
                setState("queued");
              } else if (data.status === "COMPLETED") {
                cleanupStreamAndPolling();
                setState("completed");
              }
            } catch (parseErr) {
              console.warn(
                "[useSubmitCode] Error parsing SSE payload:",
                parseErr,
              );
            }
          },
        );

        es.onerror = () => {
          // SSE connection dropped or errored — switch to fallback polling
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          if (mountedRef.current && state !== "completed") {
            startFallbackPolling(submissionId);
          }
        };
      } catch (sseErr) {
        console.warn(
          "[useSubmitCode] SSE connection failed, falling back to polling:",
          sseErr,
        );
        startFallbackPolling(submissionId);
      }
    },
    [cleanupStreamAndPolling, startFallbackPolling, state],
  );

  return { state, submission, error, submit, reset };
}
