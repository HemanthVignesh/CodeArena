"use client";

import React from "react";
import {
  Terminal,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Cpu,
  HardDrive,
  ChevronUp,
  ChevronDown,
  Loader2,
  FileCode2,
} from "lucide-react";
import { RunResult, RunState } from "@/hooks/useRunCode";
import { SubmissionStatus, SubmitState } from "@/hooks/useSubmitCode";

export type ConsoleTab = "input" | "output" | "errors" | "result";

interface ConsolePanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab: ConsoleTab;
  onSelectTab: (tab: ConsoleTab) => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  runState: RunState;
  runResult: RunResult | null;
  runError: string | null;
  submitState: SubmitState;
  submission: SubmissionStatus | null;
  submitError: string | null;
}

export function ConsolePanel({
  isOpen,
  onToggleOpen,
  activeTab,
  onSelectTab,
  inputValue,
  onInputChange,
  runState,
  runResult,
  runError,
  submitState,
  submission,
  submitError,
}: ConsolePanelProps) {
  const isRunning = runState === "submitting" || runState === "polling";
  const isSubmitting =
    submitState === "submitting" ||
    submitState === "queued" ||
    submitState === "running";

  const hasErrors =
    Boolean(runError) ||
    Boolean(submitError) ||
    Boolean(runResult?.stderr) ||
    Boolean(runResult?.compileOutput) ||
    Boolean(submission?.compileOutput) ||
    (submission?.verdict && submission.verdict !== "ACCEPTED");

  const hasOutput = Boolean(runResult?.stdout);

  // Verdict display styling helper
  const getVerdictBadge = (verdict: string | null) => {
    switch (verdict) {
      case "ACCEPTED":
        return {
          label: "Accepted",
          bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
      case "WRONG_ANSWER":
        return {
          label: "Wrong Answer",
          bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
        };
      case "TIME_LIMIT_EXCEEDED":
        return {
          label: "Time Limit Exceeded",
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
          icon: <Clock className="w-4 h-4 text-amber-400" />,
        };
      case "MEMORY_LIMIT_EXCEEDED":
        return {
          label: "Memory Limit Exceeded",
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
          icon: <HardDrive className="w-4 h-4 text-amber-400" />,
        };
      case "COMPILATION_ERROR":
        return {
          label: "Compilation Error",
          bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
        };
      case "RUNTIME_ERROR":
        return {
          label: "Runtime Error",
          bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
          icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
        };
      case "INTERNAL_ERROR":
        return {
          label: "Internal Error",
          bg: "bg-slate-500/15 border-slate-500/30 text-slate-400",
          icon: <AlertTriangle className="w-4 h-4 text-slate-400" />,
        };
      default:
        return {
          label: verdict || "Processing",
          bg: "bg-slate-800 border-slate-700 text-slate-300",
          icon: <Clock className="w-4 h-4 text-slate-400" />,
        };
    }
  };

  return (
    <div className="border-t border-slate-800 bg-[#0d111a] flex flex-col transition-all duration-200">
      {/* Console Tab Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Input Tab */}
          <button
            onClick={() => onSelectTab("input")}
            className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-colors ${
              activeTab === "input"
                ? "bg-slate-800 text-emerald-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Custom Input
          </button>

          {/* Output Tab */}
          <button
            onClick={() => onSelectTab("output")}
            className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
              activeTab === "output"
                ? "bg-slate-800 text-teal-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Output</span>
            {isRunning && (
              <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
            )}
            {hasOutput && !isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            )}
          </button>

          {/* Errors Tab */}
          <button
            onClick={() => onSelectTab("errors")}
            className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
              activeTab === "errors"
                ? "bg-slate-800 text-rose-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Errors</span>
            {hasErrors && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          {/* Result / Verdict Tab */}
          <button
            onClick={() => onSelectTab("result")}
            className={`px-3 py-1 rounded-md text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 ${
              activeTab === "result"
                ? "bg-slate-800 text-purple-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Verdict / Result</span>
            {isSubmitting && (
              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
            )}
            {submission?.verdict === "ACCEPTED" && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            )}
            {submission?.verdict && submission.verdict !== "ACCEPTED" && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            )}
          </button>
        </div>

        <button
          onClick={onToggleOpen}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs shrink-0"
          title={isOpen ? "Collapse Console" : "Expand Console"}
          aria-label={isOpen ? "Collapse Console" : "Expand Console"}
        >
          <span className="text-[11px] font-mono">
            {isOpen ? "Hide" : "Console"}
          </span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Console Content */}
      {isOpen && (
        <div className="p-4 h-52 overflow-y-auto font-mono text-xs">
          {/* 1. INPUT TAB */}
          {activeTab === "input" && (
            <div className="h-full flex flex-col">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                Standard Input (stdin) Passed To Custom Execution
              </label>
              <textarea
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Enter custom stdin input here..."
                className="w-full flex-1 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono resize-none"
              />
            </div>
          )}

          {/* 2. OUTPUT TAB */}
          {activeTab === "output" && (
            <div className="h-full flex flex-col">
              {isRunning ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                  <p className="text-xs font-mono">
                    {runState === "submitting"
                      ? "Dispatching to execution queue..."
                      : "Executing in isolated Docker sandbox..."}
                  </p>
                </div>
              ) : runResult ? (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-500">Status:</span>
                      <span
                        className={`font-semibold ${
                          runResult.isSuccess
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {runResult.executionStatus}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-slate-500">
                      <span>{runResult.executionTimeMs} ms</span>
                      {runResult.memoryUsedKb && (
                        <span>
                          {(runResult.memoryUsedKb / 1024).toFixed(1)} MB
                        </span>
                      )}
                    </span>
                  </div>
                  <pre className="flex-1 p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 text-slate-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {runResult.stdout || (
                      <span className="text-slate-600 italic">
                        (No standard output produced)
                      </span>
                    )}
                  </pre>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-1">
                  <Terminal className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                  <p className="text-slate-400 font-medium">
                    No execution output
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Click &apos;Run&apos; to execute your code with custom
                    stdin.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. ERRORS TAB */}
          {activeTab === "errors" && (
            <div className="h-full flex flex-col">
              {runError || submitError ? (
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-300 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Error</span>
                  </div>
                  <p className="text-xs text-rose-200">
                    {runError || submitError}
                  </p>
                </div>
              ) : runResult?.compileOutput || submission?.compileOutput ? (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Compiler Output</span>
                  </div>
                  <pre className="flex-1 p-3 rounded-xl bg-slate-950/90 border border-rose-900/40 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {runResult?.compileOutput || submission?.compileOutput}
                  </pre>
                </div>
              ) : runResult?.stderr ? (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Standard Error (stderr)</span>
                  </div>
                  <pre className="flex-1 p-3 rounded-xl bg-slate-950/90 border border-rose-900/40 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {runResult.stderr}
                  </pre>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-1">
                  <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
                  <p className="text-slate-400 font-medium">
                    No errors detected
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Compiler warnings and runtime exceptions will appear here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4. RESULT / VERDICT TAB */}
          {activeTab === "result" && (
            <div className="h-full flex flex-col justify-center">
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {submitState === "submitting"
                        ? "Creating submission record..."
                        : submitState === "queued"
                          ? "Waiting for judge..."
                          : "Running test cases..."}
                    </p>
                    {submission?.id && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        Submission #{submission.id.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>
              ) : submission ? (
                <div className="space-y-3">
                  {/* Verdict Header Banner */}
                  {(() => {
                    const badge = getVerdictBadge(submission.verdict);
                    return (
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between ${badge.bg}`}
                      >
                        <div className="flex items-center gap-2.5">
                          {badge.icon}
                          <span className="text-base font-bold tracking-wide">
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono opacity-70">
                          #{submission.id.slice(0, 8)}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">
                          Runtime
                        </div>
                        <div className="font-semibold text-slate-200 text-xs">
                          {submission.runtimeMs !== null
                            ? `${submission.runtimeMs} ms`
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">
                          Memory
                        </div>
                        <div className="font-semibold text-slate-200 text-xs">
                          {submission.memoryKb !== null
                            ? `${(submission.memoryKb / 1024).toFixed(1)} MB`
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">
                          Test Cases
                        </div>
                        <div className="font-semibold text-slate-200 text-xs">
                          {submission.passedCases !== null &&
                          submission.totalCases !== null
                            ? `${submission.passedCases} / ${submission.totalCases}`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error detail if any */}
                  {submission.errorMessage && (
                    <div className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-rose-300 text-[11px]">
                      {submission.errorMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-500 space-y-1">
                  <FileCode2 className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                  <p className="text-slate-400 font-medium">
                    No active submission
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Click &apos;Submit&apos; to evaluate your code against all
                    test cases.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
