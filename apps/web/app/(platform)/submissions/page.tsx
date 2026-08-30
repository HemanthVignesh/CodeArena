import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, Language, Verdict } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  AlertTriangle,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

interface SubmissionsPageProps {
  searchParams: {
    page?: string;
    problem?: string;
    language?: string;
    verdict?: string;
  };
}

export const dynamic = "force-dynamic";

export default async function SubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
  // 1. Authenticate user
  const auth = await getCurrentUser();
  if (!auth) {
    redirect("/login?from=/submissions");
  }

  // 2. Parse pagination & filters
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const problemParam = searchParams.problem?.trim();
  const languageParam = searchParams.language?.trim().toUpperCase();
  const verdictParam = searchParams.verdict?.trim().toUpperCase();

  // Validate filters
  let languageFilter: Language | undefined;
  if (
    languageParam &&
    Object.values(Language).includes(languageParam as Language)
  ) {
    languageFilter = languageParam as Language;
  }

  let verdictFilter: Verdict | undefined;
  if (
    verdictParam &&
    Object.values(Verdict).includes(verdictParam as Verdict)
  ) {
    verdictFilter = verdictParam as Verdict;
  }

  // 3. Construct Prisma where clause — strictly scoped to authenticated user
  const where: any = {
    userId: auth.user.id,
  };

  if (languageFilter) {
    where.language = languageFilter;
  }

  if (verdictFilter) {
    where.verdict = verdictFilter;
  }

  if (problemParam) {
    where.problem = {
      OR: [{ slug: problemParam }, { id: problemParam }],
    };
  }

  // 4. Query total count and paginated items in parallel
  const [total, submissions, availableProblems] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        problemId: true,
        language: true,
        status: true,
        verdict: true,
        executionTimeMs: true,
        memoryUsedKb: true,
        passedCases: true,
        totalCases: true,
        createdAt: true,
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
          },
        },
      },
    }),
    // Fetch distinct published problems for filter dropdown
    prisma.problem.findMany({
      where: { isPublished: true },
      select: { slug: true, title: true },
      orderBy: { title: "asc" },
      take: 50,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  // Helper for Verdict badge rendering
  const renderVerdictBadge = (verdict: Verdict | null, status: string) => {
    if (status !== "COMPLETED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{status === "RUNNING" ? "Running" : "Queued"}</span>
        </span>
      );
    }

    switch (verdict) {
      case Verdict.ACCEPTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Accepted</span>
          </span>
        );
      case Verdict.WRONG_ANSWER:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Wrong Answer</span>
          </span>
        );
      case Verdict.TIME_LIMIT_EXCEEDED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Time Limit Exceeded</span>
          </span>
        );
      case Verdict.MEMORY_LIMIT_EXCEEDED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>Memory Limit Exceeded</span>
          </span>
        );
      case Verdict.COMPILATION_ERROR:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Compilation Error</span>
          </span>
        );
      case Verdict.RUNTIME_ERROR:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Runtime Error</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400 font-mono">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Internal Error</span>
          </span>
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
        return "TypeScript";
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

  // Helper to build URL query with updated parameter
  const buildFilterUrl = (paramsToUpdate: Record<string, string | null>) => {
    const urlParams = new URLSearchParams();
    if (problemParam) urlParams.set("problem", problemParam);
    if (languageParam) urlParams.set("language", languageParam);
    if (verdictParam) urlParams.set("verdict", verdictParam);

    Object.entries(paramsToUpdate).forEach(([key, val]) => {
      if (val === null || val === "") {
        urlParams.delete(key);
      } else {
        urlParams.set(key, val);
      }
    });

    const str = urlParams.toString();
    return str ? `/submissions?${str}` : "/submissions";
  };

  const hasActiveFilters = Boolean(
    problemParam || languageParam || verdictParam,
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0d14] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Terminal className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Submission History
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Review your past code submissions, test case evaluation verdicts,
              and execution performance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/problems"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-sm"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>Solve Problems</span>
            </Link>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-[#0e1320] border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filters:</span>
            </div>

            {/* Problem Filter */}
            <form method="GET" action="/submissions" className="inline-block">
              {languageParam && (
                <input type="hidden" name="language" value={languageParam} />
              )}
              {verdictParam && (
                <input type="hidden" name="verdict" value={verdictParam} />
              )}
              <select
                name="problem"
                defaultValue={problemParam || ""}
                // @ts-ignore
                onChange={(e) => e.target.form?.submit()}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Problems</option>
                {availableProblems.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.title}
                  </option>
                ))}
              </select>
            </form>

            {/* Language Filter */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <Link
                href={buildFilterUrl({ language: null, page: "1" })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  !languageFilter
                    ? "bg-slate-800 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All Languages
              </Link>
              {Object.values(Language).map((lang) => (
                <Link
                  key={lang}
                  href={buildFilterUrl({ language: lang, page: "1" })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    languageFilter === lang
                      ? "bg-slate-800 text-emerald-400 font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {lang === "PYTHON"
                    ? "Python"
                    : lang === "CPP"
                      ? "C++"
                      : "TypeScript"}
                </Link>
              ))}
            </div>

            {/* Verdict Filter */}
            <form method="GET" action="/submissions" className="inline-block">
              {problemParam && (
                <input type="hidden" name="problem" value={problemParam} />
              )}
              {languageParam && (
                <input type="hidden" name="language" value={languageParam} />
              )}
              <select
                name="verdict"
                defaultValue={verdictParam || ""}
                // @ts-ignore
                onChange={(e) => e.target.form?.submit()}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Verdicts</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="WRONG_ANSWER">Wrong Answer</option>
                <option value="TIME_LIMIT_EXCEEDED">Time Limit Exceeded</option>
                <option value="MEMORY_LIMIT_EXCEEDED">
                  Memory Limit Exceeded
                </option>
                <option value="COMPILATION_ERROR">Compilation Error</option>
                <option value="RUNTIME_ERROR">Runtime Error</option>
              </select>
            </form>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Link
              href="/submissions"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Link>
          )}
        </div>

        {/* Submissions Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#0e1320] overflow-hidden shadow-xl shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">
                    Verdict / Status
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Problem</th>
                  <th className="py-3.5 px-4 font-semibold">Language</th>
                  <th className="py-3.5 px-4 font-semibold">Runtime</th>
                  <th className="py-3.5 px-4 font-semibold">Memory</th>
                  <th className="py-3.5 px-4 font-semibold">Test Cases</th>
                  <th className="py-3.5 px-4 font-semibold">Submitted</th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {submissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-16 text-center text-slate-500"
                    >
                      <Terminal className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                      <p className="text-base font-semibold text-slate-300">
                        No submissions found
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {hasActiveFilters
                          ? "No submissions match your active filter criteria. Try resetting the filters."
                          : "You have not submitted any solutions yet. Head over to the problems catalog to get started!"}
                      </p>
                      {!hasActiveFilters && (
                        <Link
                          href="/problems"
                          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                          <Code2 className="w-4 h-4" />
                          <span>Browse Problems</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-800/20 transition-colors"
                    >
                      {/* Verdict */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderVerdictBadge(sub.verdict, sub.status)}
                      </td>

                      {/* Problem Title & Difficulty */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/problems/${sub.problem.slug}`}
                            className="font-medium text-slate-200 hover:text-emerald-400 transition-colors"
                          >
                            {sub.problem.title}
                          </Link>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getDifficultyColor(
                              sub.problem.difficulty,
                            )}`}
                          >
                            {sub.problem.difficulty}
                          </span>
                        </div>
                      </td>

                      {/* Language */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                        {getLanguageLabel(sub.language)}
                      </td>

                      {/* Runtime */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                        {sub.status === "COMPLETED" &&
                        sub.executionTimeMs !== null ? (
                          <span>{sub.executionTimeMs} ms</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Memory */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                        {sub.status === "COMPLETED" &&
                        sub.memoryUsedKb &&
                        sub.memoryUsedKb > 0 ? (
                          <span>{(sub.memoryUsedKb / 1024).toFixed(1)} MB</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Test Cases */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-300">
                        {sub.status === "COMPLETED" && sub.totalCases > 0 ? (
                          <span>
                            {sub.passedCases} / {sub.totalCases}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td
                        className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]"
                        title={new Date(sub.createdAt).toLocaleString()}
                      >
                        {new Date(sub.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <Link
                          href={`/submissions/${sub.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                        >
                          <span>View Code</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/80 bg-slate-950/40 text-xs">
              <div className="text-slate-400 font-mono">
                Showing{" "}
                <span className="text-slate-200">
                  {(page - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="text-slate-200">
                  {Math.min(page * pageSize, total)}
                </span>{" "}
                of <span className="text-slate-200">{total}</span> submissions
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={buildFilterUrl({ page: String(page - 1) })}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium transition-colors ${
                    page <= 1
                      ? "opacity-40 pointer-events-none text-slate-600"
                      : "text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-900"
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Link>

                <span className="text-slate-400 font-mono px-2">
                  Page {page} of {totalPages}
                </span>

                <Link
                  href={buildFilterUrl({ page: String(page + 1) })}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium transition-colors ${
                    page >= totalPages
                      ? "opacity-40 pointer-events-none text-slate-600"
                      : "text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-900"
                  }`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
