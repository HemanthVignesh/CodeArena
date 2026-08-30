import { requireUser } from "@/lib/auth";
import Link from "next/link";
import {
  Award,
  Flame,
  Zap,
  ArrowRight,
  Code2,
  History,
  Shield,
} from "lucide-react";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  let auth;
  try {
    auth = await requireUser();
  } catch {
    redirect("/login?redirect=/dashboard");
  }

  const { user, profile } = auth;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0f1523] to-slate-900 border border-slate-800 shadow-xl mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                {user.role}
              </span>
              <span className="text-xs text-slate-400">
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome back,{" "}
              <span className="text-emerald-400">{user.username}</span>!
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Ready for your next algorithm challenge? Your sandbox execution
              engine is ready.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/problems"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-md shadow-emerald-500/20"
            >
              <Code2 className="w-4 h-4" />
              <span>Explore Problems</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Arena Rating
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {profile?.rating ?? 1200}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Calculated dynamically
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Solved Problems
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {profile?.totalSolved ?? 0}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
            <span className="text-emerald-400">
              {profile?.easySolved ?? 0}E
            </span>
            <span>•</span>
            <span className="text-amber-400">
              {profile?.mediumSolved ?? 0}M
            </span>
            <span>•</span>
            <span className="text-rose-400">{profile?.hardSolved ?? 0}H</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Current Streak
            </span>
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {profile?.currentStreak ?? 0} Days
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Max: {profile?.maxStreak ?? 0} days
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Submissions
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {profile?.totalSubmissions ?? 0}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Across all languages
          </span>
        </div>
      </div>

      {/* Account Info Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        <h2 className="text-lg font-bold text-white mb-4">
          Account Security &amp; Session
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">
              Email Address
            </span>
            <span className="font-mono text-slate-200">{user.email}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">
              Session Status
            </span>
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Active Database-Backed Session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
