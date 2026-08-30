import React from "react";
import Link from "next/link";
import { prisma, Difficulty } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";
import {
  Search,
  Filter,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Tag as TagIcon,
  X,
} from "lucide-react";

interface ProblemsPageProps {
  searchParams: {
    page?: string;
    search?: string;
    difficulty?: string;
    tag?: string;
  };
}

export const dynamic = "force-dynamic";

export default async function ProblemsPage({
  searchParams,
}: ProblemsPageProps) {
  const auth = await getCurrentUser();
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const searchQuery = searchParams.search?.trim();
  const difficultyParam = searchParams.difficulty?.toUpperCase();
  const selectedTag = searchParams.tag?.trim();

  // Validate difficulty filter
  let difficultyFilter: Difficulty | undefined;
  if (
    difficultyParam &&
    Object.values(Difficulty).includes(difficultyParam as Difficulty)
  ) {
    difficultyFilter = difficultyParam as Difficulty;
  }

  // Construct database filter
  const where: any = {
    isPublished: true,
  };

  if (difficultyFilter) {
    where.difficulty = difficultyFilter;
  }

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { slug: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  if (selectedTag) {
    const tagSlug = selectedTag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    where.tags = {
      some: {
        tag: {
          OR: [
            { slug: tagSlug },
            { name: { equals: selectedTag, mode: "insensitive" } },
          ],
        },
      },
    };
  }

  // Fetch problems, tags, and total count concurrently
  const [problems, total, allTags] = await Promise.all([
    prisma.problem.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        difficulty: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        acceptanceRate: true,
        totalAccepted: true,
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
    prisma.problem.count({ where }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

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

  const hasFilters = Boolean(searchQuery || difficultyFilter || selectedTag);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Problem Catalog
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Explore algorithm and data structure problems with deterministic
            judge evaluation.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Showing{" "}
          <span className="text-emerald-400 font-semibold">
            {problems.length}
          </span>{" "}
          of <span className="text-white font-semibold">{total}</span> problems
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 mb-6 flex flex-col md:flex-row items-center gap-4">
        {/* Search Input Form */}
        <form
          method="GET"
          action="/problems"
          className="relative flex-1 w-full"
        >
          <input
            type="hidden"
            name="difficulty"
            value={difficultyParam || ""}
          />
          <input type="hidden" name="tag" value={selectedTag || ""} />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            name="search"
            defaultValue={searchQuery || ""}
            placeholder="Search problems by title or keyword..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all"
          />
        </form>

        {/* Difficulty Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {["ALL", "EASY", "MEDIUM", "HARD"].map((diff) => {
            const isActive =
              (diff === "ALL" && !difficultyFilter) ||
              (difficultyFilter && diff === difficultyFilter);

            const buildFilterUrl = () => {
              const params = new URLSearchParams();
              if (searchQuery) params.set("search", searchQuery);
              if (selectedTag) params.set("tag", selectedTag);
              if (diff !== "ALL") params.set("difficulty", diff);
              return `/problems?${params.toString()}`;
            };

            return (
              <Link
                key={diff}
                href={buildFilterUrl()}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                {diff}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tags Carousel / Chips Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0 pl-1">
          <TagIcon className="w-3.5 h-3.5" /> Tags:
        </span>
        {allTags.map((t) => {
          const isSelected =
            selectedTag?.toLowerCase() === t.name.toLowerCase() ||
            selectedTag === t.slug;

          const buildTagUrl = () => {
            const params = new URLSearchParams();
            if (searchQuery) params.set("search", searchQuery);
            if (difficultyFilter) params.set("difficulty", difficultyFilter);
            if (!isSelected) params.set("tag", t.slug);
            return `/problems?${params.toString()}`;
          };

          return (
            <Link
              key={t.id}
              href={buildTagUrl()}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                isSelected
                  ? "bg-emerald-950 text-emerald-300 border-emerald-700 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {t.name}
            </Link>
          );
        })}

        {hasFilters && (
          <Link
            href="/problems"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-400 bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/40 transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
            Clear Filters
          </Link>
        )}
      </div>

      {/* Problems Table */}
      <div className="rounded-2xl bg-[#0f1420]/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-xs uppercase">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">Status</th>
                <th className="py-3.5 px-4">Title</th>
                <th className="py-3.5 px-4 w-28">Difficulty</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Tags</th>
                <th className="py-3.5 px-4 w-28 text-right hidden sm:table-cell">
                  Acceptance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {problems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <p className="text-base font-semibold text-slate-400 mb-1">
                      No problems found
                    </p>
                    <p className="text-xs">
                      Try adjusting your search query or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                problems.map((p, idx) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-4 px-4 text-center">
                      <Circle className="w-4 h-4 text-slate-600 inline" />
                    </td>
                    <td className="py-4 px-4">
                      <Link
                        href={`/problems/${p.slug}`}
                        className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors"
                      >
                        {p.title}
                      </Link>
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
                    <td className="py-4 px-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span
                            key={t.tag.id}
                            className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 text-xs font-medium border border-slate-800"
                          >
                            {t.tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-xs text-slate-400 hidden sm:table-cell">
                      {p.acceptanceRate
                        ? `${p.acceptanceRate.toFixed(1)}%`
                        : "0.0%"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Page <span className="font-semibold text-white">{page}</span> of{" "}
              <span className="font-semibold text-white">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <Link
                href={`/problems?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(difficultyFilter ? { difficulty: difficultyFilter } : {}),
                  ...(selectedTag ? { tag: selectedTag } : {}),
                  page: String(Math.max(1, page - 1)),
                }).toString()}`}
                className={`p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
                  page <= 1 ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>

              <Link
                href={`/problems?${new URLSearchParams({
                  ...(searchQuery ? { search: searchQuery } : {}),
                  ...(difficultyFilter ? { difficulty: difficultyFilter } : {}),
                  ...(selectedTag ? { tag: selectedTag } : {}),
                  page: String(Math.min(totalPages, page + 1)),
                }).toString()}`}
                className={`p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
                  page >= totalPages ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
