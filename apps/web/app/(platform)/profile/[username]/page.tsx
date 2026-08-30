import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, Difficulty } from "@codearena/db";
import { getUserStatistics } from "@/lib/statistics";
import { getCurrentUser } from "@/lib/auth";
import { ActivityCalendar } from "@/components/profile/ActivityCalendar";
import {
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Calendar,
  Code2,
  ExternalLink,
  Github,
  Linkedin,
  Terminal,
  Zap,
  TrendingUp,
  Shield,
  Layers,
} from "lucide-react";

interface ProfilePageProps {
  params: {
    username: string;
  };
}

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const rawUsername = params.username?.trim();
  if (!rawUsername) {
    notFound();
  }

  // 1. Fetch user by username (case-insensitive)
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: rawUsername,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      profile: {
        select: {
          rating: true,
          bio: true,
          avatarUrl: true,
          githubUrl: true,
          linkedinUrl: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  // 2. Fetch authoritative statistics & total catalog problem counts in parallel
  const [stats, totalProblems, easyTotal, mediumTotal, hardTotal, currentAuth] =
    await Promise.all([
      getUserStatistics(user.id),
      prisma.problem.count({ where: { isPublished: true } }),
      prisma.problem.count({
        where: { isPublished: true, difficulty: Difficulty.EASY },
      }),
      prisma.problem.count({
        where: { isPublished: true, difficulty: Difficulty.MEDIUM },
      }),
      prisma.problem.count({
        where: { isPublished: true, difficulty: Difficulty.HARD },
      }),
      getCurrentUser(),
    ]);

  const isSelf = currentAuth?.user?.id === user.id;
  const initial = user.username.charAt(0).toUpperCase();

  const easyPercent =
    easyTotal > 0
      ? Math.min(100, Math.round((stats.easySolved / easyTotal) * 100))
      : 0;
  const mediumPercent =
    mediumTotal > 0
      ? Math.min(100, Math.round((stats.mediumSolved / mediumTotal) * 100))
      : 0;
  const hardPercent =
    hardTotal > 0
      ? Math.min(100, Math.round((stats.hardSolved / hardTotal) * 100))
      : 0;

  const totalPercent =
    totalProblems > 0
      ? Math.min(100, Math.round((stats.totalSolved / totalProblems) * 100))
      : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0d14] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: User Card (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800/80 space-y-6 shadow-xl shadow-black/20">
              {/* Avatar & Username */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20">
                  <div className="w-full h-full bg-[#0a0d14] rounded-[15px] flex items-center justify-center text-2xl font-black text-emerald-400">
                    {initial}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {user.username}
                    </h1>
                    {user.role === "ADMIN" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                        <Shield className="w-3 h-3" />
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Joined{" "}
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {user.profile?.bio ? (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {user.profile.bio}
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Algorithm enthusiast & competitive programmer.
                </p>
              )}

              {/* Rating & Rank Pills */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                    Rating
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span className="text-lg font-bold font-mono text-slate-100">
                      {user.profile?.rating ?? 1200}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                    Solved Rate
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <TrendingUp className="w-4 h-4 text-teal-400" />
                    <span className="text-lg font-bold font-mono text-slate-100">
                      {stats.acceptanceRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              {(user.profile?.githubUrl || user.profile?.linkedinUrl) && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  {user.profile.githubUrl && (
                    <a
                      href={user.profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="GitHub Profile"
                    >
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {user.profile.linkedinUrl && (
                    <a
                      href={user.profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                      title="LinkedIn Profile"
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Self Action Shortcut */}
              {isSelf && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                  <Link
                    href="/submissions"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white transition-colors"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View My Submissions</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Streak Highlights Card */}
            <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800/80 space-y-4 shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Streak Stats</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                    Current Streak
                  </span>
                  <div className="text-2xl font-extrabold font-mono text-amber-300 mt-1">
                    {stats.currentStreak}
                    <span className="text-xs font-normal text-amber-400/80 ml-1">
                      days
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                    Longest Streak
                  </span>
                  <div className="text-2xl font-extrabold font-mono text-slate-200 mt-1">
                    {stats.longestStreak}
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      days
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Solved Breakdown, Activity & Progress (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Solved Problems Overview Card */}
            <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800/80 shadow-xl shadow-black/20 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Problem Solving Progress
                    </h2>
                    <p className="text-xs text-slate-400">
                      Breakdown by algorithm difficulty level
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-extrabold font-mono text-emerald-400">
                    {stats.totalSolved}
                  </span>
                  <span className="text-xs font-mono text-slate-500 ml-1">
                    / {totalProblems} solved ({totalPercent}%)
                  </span>
                </div>
              </div>

              {/* Progress Bars Breakdown */}
              <div className="space-y-4">
                {/* Easy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Easy
                    </span>
                    <span className="font-mono text-slate-300">
                      <span className="font-bold text-white">
                        {stats.easySolved}
                      </span>{" "}
                      / {easyTotal}{" "}
                      <span className="text-slate-500">({easyPercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ width: `${easyPercent}%` }}
                    />
                  </div>
                </div>

                {/* Medium */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Medium
                    </span>
                    <span className="font-mono text-slate-300">
                      <span className="font-bold text-white">
                        {stats.mediumSolved}
                      </span>{" "}
                      / {mediumTotal}{" "}
                      <span className="text-slate-500">({mediumPercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                      style={{ width: `${mediumPercent}%` }}
                    />
                  </div>
                </div>

                {/* Hard */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      Hard
                    </span>
                    <span className="font-mono text-slate-300">
                      <span className="font-bold text-white">
                        {stats.hardSolved}
                      </span>{" "}
                      / {hardTotal}{" "}
                      <span className="text-slate-500">({hardPercent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-400 transition-all duration-500"
                      style={{ width: `${hardPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Submissions Aggregates Row */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    Total Submissions
                  </span>
                  <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                    {stats.totalSubmissions}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    Accepted Submissions
                  </span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    {stats.acceptedSubmissions}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    Accuracy
                  </span>
                  <div className="text-lg font-bold font-mono text-teal-300 mt-0.5">
                    {stats.acceptanceRate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Submission Activity Calendar */}
            <ActivityCalendar
              activityMap={stats.activityMap}
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
            />

            {/* Recent Solved Problems Card */}
            <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800/80 shadow-xl shadow-black/20 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Recently Solved Problems
                  </h3>
                </div>

                <Link
                  href="/problems"
                  className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <span>Solve more</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {stats.recentSolvedProblems.length === 0 ? (
                <div className="py-8 text-center text-slate-500 space-y-2">
                  <Code2 className="w-8 h-8 mx-auto text-slate-600 mb-1" />
                  <p className="text-xs font-semibold text-slate-400">
                    No solved problems yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Submit code solutions that pass all test cases to see your
                    progress here!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {stats.recentSolvedProblems.map((prob) => (
                    <div
                      key={prob.id}
                      className="py-3 flex items-center justify-between hover:bg-slate-800/20 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <Link
                          href={`/problems/${prob.slug}`}
                          className="text-xs font-semibold text-slate-200 hover:text-emerald-400 transition-colors"
                        >
                          {prob.title}
                        </Link>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          prob.difficulty === Difficulty.EASY
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                            : prob.difficulty === Difficulty.MEDIUM
                              ? "bg-amber-950/80 text-amber-400 border-amber-800/60"
                              : "bg-rose-950/80 text-rose-400 border-rose-800/60"
                        }`}
                      >
                        {prob.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
