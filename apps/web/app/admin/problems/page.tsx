import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, Difficulty } from "@codearena/db";
import { requireAdmin } from "@/lib/auth";
import {
  Plus,
  Search,
  Shield,
  Edit,
  Database,
  ExternalLink,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface AdminProblemsPageProps {
  searchParams: {
    search?: string;
    difficulty?: string;
    published?: string;
  };
}

export const dynamic = "force-dynamic";

export default async function AdminProblemsPage({
  searchParams,
}: AdminProblemsPageProps) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?redirect=/admin/problems");
  }

  const searchQuery = searchParams.search?.trim();
  const difficultyParam = searchParams.difficulty?.toUpperCase();
  const publishedParam = searchParams.published;

  const where: any = {};

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { slug: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  if (
    difficultyParam &&
    Object.values(Difficulty).includes(difficultyParam as Difficulty)
  ) {
    where.difficulty = difficultyParam as Difficulty;
  }

  if (publishedParam === "true") {
    where.isPublished = true;
  } else if (publishedParam === "false") {
    where.isPublished = false;
  }

  const problems = await prisma.problem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      _count: {
        select: {
          testCases: true,
        },
      },
    },
  });

  const getDifficultyBadge = (diff: Difficulty) => {
    switch (diff) {
      case Difficulty.EASY:
        return "bg-emerald-950/80 text-emerald-400 border-emerald-800/60";
      case Difficulty.MEDIUM:
        return "bg-amber-950/80 text-amber-400 border-amber-800/60";
      case Difficulty.HARD:
        return "bg-rose-950/80 text-rose-400 border-rose-800/60";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-amber-950 text-amber-400 border border-amber-800/50">
              <Shield className="w-3 h-3" />
              ADMIN PANEL
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Problem Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Create, edit, configure test cases, and publish competitive
            programming problems.
          </p>
        </div>

        <Link
          href="/admin/problems/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Problem</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 mb-6 flex flex-col md:flex-row items-center gap-4">
        <form
          method="GET"
          action="/admin/problems"
          className="relative flex-1 w-full"
        >
          <input
            type="hidden"
            name="difficulty"
            value={difficultyParam || ""}
          />
          <input type="hidden" name="published" value={publishedParam || ""} />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            name="search"
            defaultValue={searchQuery || ""}
            placeholder="Search problems by title or slug..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Link
            href="/admin/problems"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800"
          >
            Reset Filters
          </Link>
        </div>
      </div>

      {/* Admin Problems Table */}
      <div className="rounded-2xl bg-[#0f1420]/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-xs uppercase">
              <tr>
                <th className="py-3.5 px-4">Title &amp; Slug</th>
                <th className="py-3.5 px-4 w-28">Difficulty</th>
                <th className="py-3.5 px-4 w-24">Status</th>
                <th className="py-3.5 px-4 w-28 text-center">Test Cases</th>
                <th className="py-3.5 px-4 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {problems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No problems found matching criteria.
                  </td>
                </tr>
              ) : (
                problems.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-200">
                        {p.title}
                      </div>
                      <div className="text-xs font-mono text-slate-500">
                        {p.slug}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyBadge(
                          p.difficulty,
                        )}`}
                      >
                        {p.difficulty}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {p.isPublished ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                          <XCircle className="w-3.5 h-3.5" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-xs text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {p._count.testCases} Cases
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/problems/${p.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Edit Problem"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/problems/${p.id}/test-cases`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                          title="Manage Test Cases"
                        >
                          <Database className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/problems/${p.slug}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                          title="View Problem Workspace"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
