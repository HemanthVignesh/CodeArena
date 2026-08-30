import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma, Language, Verdict } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { SubmissionCodeViewer } from "@/components/submissions/SubmissionCodeViewer";
import {
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  Terminal,
  Cpu,
  ShieldAlert,
  Code2,
  Calendar,
  ExternalLink,
} from "lucide-react";

interface SubmissionDetailPageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  // 1. Authenticate user
  const auth = await getCurrentUser();
  if (!auth) {
    redirect(`/login?from=/submissions/${params.id}`);
  }

  const submissionId = params.id?.trim();
  if (!submissionId) {
    notFound();
  }

  // 2. Fetch submission record
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          timeLimitMs: true,
          memoryLimitMb: true,
        },
      },
    },
  });

  if (!submission) {
    notFound();
  }

  // 3. Strict Authorization Check (Owner or ADMIN only)
  const isOwner = submission.userId === auth.user.id;
  const isAdmin = auth.user.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0a0d14] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-2xl bg-[#0e1320] border border-rose-900/40 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white">Access Denied</h1>
            <p className="text-xs text-slate-400">
              You do not have permission to view this submission. Source code
              and execution metrics are private to the submission owner.
            </p>
          </div>
          <Link
            href="/submissions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to My Submissions</span>
          </Link>
        </div>
      </div>
    );
  }

  // Helper for Verdict badge rendering
  const renderVerdictBanner = () => {
    if (submission.status !== "COMPLETED") {
      return (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-400 animate-spin" />
            <div>
              <div className="text-sm font-bold text-white font-mono">
                {submission.status === "RUNNING"
                  ? "Running Test Cases"
                  : "Queued in Judge Worker"}
              </div>
              <div className="text-xs text-slate-400">
                Evaluation is in progress inside the isolated sandbox.
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">
            #{submission.id.slice(0, 8)}
          </span>
        </div>
      );
    }

    switch (submission.verdict) {
      case Verdict.ACCEPTED:
        return (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide">Accepted</div>
                <div className="text-xs text-emerald-300/80">
                  All {submission.totalCases} test cases passed successfully.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
      case Verdict.WRONG_ANSWER:
        return (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20">
                <XCircle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide">
                  Wrong Answer
                </div>
                <div className="text-xs text-rose-300/80">
                  Output comparison failed on test case evaluation.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
      case Verdict.TIME_LIMIT_EXCEEDED:
        return (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide">
                  Time Limit Exceeded
                </div>
                <div className="text-xs text-amber-300/80">
                  Execution exceeded the allowed{" "}
                  {submission.problem.timeLimitMs}ms time limit.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
      case Verdict.MEMORY_LIMIT_EXCEEDED:
        return (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <HardDrive className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide">
                  Memory Limit Exceeded
                </div>
                <div className="text-xs text-amber-300/80">
                  Peak memory usage exceeded the allowed{" "}
                  {submission.problem.memoryLimitMb}MB limit.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
      case Verdict.COMPILATION_ERROR:
        return (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide">
                  Compilation Error
                </div>
                <div className="text-xs text-rose-300/80">
                  Source code could not be compiled. Review the diagnostic
                  output below.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
      case Verdict.RUNTIME_ERROR:
        return (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-400">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-wide">
                  Runtime Error
                </div>
                <div className="text-xs text-rose-300/80">
                  Process raised an unhandled exception during test case
                  execution.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
      default:
        return (
          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-slate-400" />
              <div>
                <div className="text-lg font-bold">Internal Error</div>
                <div className="text-xs text-slate-400">
                  An unexpected error occurred during execution.
                </div>
              </div>
            </div>
            <span className="text-xs font-mono opacity-70">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
        );
    }
  };

  const getLanguageLabel = (lang: Language) => {
    switch (lang) {
      case Language.PYTHON:
        return "Python 3.12";
      case Language.CPP:
        return "C++20";
      case Language.TYPESCRIPT:
        return "TypeScript (Node 20)";
      default:
        return lang;
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "EASY":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "MEDIUM":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "HARD":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      default:
        return "text-slate-400 bg-slate-800 border-slate-700";
    }
  };

  const monacoLang =
    SUPPORTED_LANGUAGES.find((l) => l.id === submission.language)?.monacoLang ||
    "python";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0d14] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between">
          <Link
            href="/submissions"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to All Submissions</span>
          </Link>

          <Link
            href={`/problems/${submission.problem.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Open in Problem Solver</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
          </Link>
        </div>

        {/* Problem Header Card */}
        <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {submission.problem.title}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold border ${getDifficultyColor(
                    submission.problem.difficulty,
                  )}`}
                >
                  {submission.problem.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Submitted on{" "}
                    {new Date(submission.createdAt).toLocaleString()}
                  </span>
                </span>
                <span>•</span>
                <span>ID: {submission.id}</span>
              </div>
            </div>
          </div>

          {/* Verdict Banner */}
          {renderVerdictBanner()}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {/* Runtime */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Runtime</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-200">
                {submission.status === "COMPLETED" &&
                submission.executionTimeMs !== null
                  ? `${submission.executionTimeMs} ms`
                  : "—"}
              </div>
            </div>

            {/* Memory */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">
                <Cpu className="w-3 h-3 text-slate-400" />
                <span>Memory</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-200">
                {submission.status === "COMPLETED" &&
                submission.memoryUsedKb &&
                submission.memoryUsedKb > 0
                  ? `${(submission.memoryUsedKb / 1024).toFixed(1)} MB`
                  : "—"}
              </div>
            </div>

            {/* Test Cases */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">
                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                <span>Test Cases</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-200">
                {submission.status === "COMPLETED"
                  ? `${submission.passedCases} / ${submission.totalCases}`
                  : "—"}
              </div>
            </div>

            {/* Language */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">
                <Code2 className="w-3 h-3 text-slate-400" />
                <span>Language</span>
              </div>
              <div className="text-sm font-bold font-mono text-slate-200 truncate">
                {getLanguageLabel(submission.language)}
              </div>
            </div>
          </div>
        </div>

        {/* Compiler Diagnostics / Stderr (if applicable) */}
        {submission.compileOutput && (
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Compiler Output</span>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950/90 border border-rose-900/40 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
              {submission.compileOutput}
            </pre>
          </div>
        )}

        {submission.errorMessage && !submission.compileOutput && (
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>Execution Error</span>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950/90 border border-rose-900/40 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
              {submission.errorMessage}
            </pre>
          </div>
        )}

        {/* Source Code Viewer */}
        <SubmissionCodeViewer
          code={submission.code}
          language={getLanguageLabel(submission.language)}
          monacoLang={monacoLang}
        />
      </div>
    </div>
  );
}
