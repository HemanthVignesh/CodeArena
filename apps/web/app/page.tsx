import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { MVP_LANGUAGES } from "@codearena/judge-shared";
import {
  Code2,
  Terminal,
  ShieldCheck,
  Cpu,
  Database,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";

export default async function HomePage() {
  const auth = await getCurrentUser();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-6xl mx-auto w-full">
      {/* Status Pill */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-mono mb-8 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Secure Auth &amp; Asynchronous Judge Ready</span>
      </div>

      {/* Main Hero Header */}
      <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
        Master Algorithms in <br />
        <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
          The Next-Gen Code Arena
        </span>
      </h1>

      <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
        CodeArena delivers sub-second deterministic evaluation, isolated Docker
        sandboxes, and real-time verdict streaming for developers who want zero
        compromises.
      </p>

      {/* Hero Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
        {auth ? (
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-lg shadow-emerald-500/20"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/problems"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>Browse Problems</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-lg shadow-emerald-500/20"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <span>Sign In</span>
            </Link>
          </>
        )}
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mb-16">
        <div className="p-7 rounded-2xl bg-gradient-to-b from-[#111622] to-[#0d121c] border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">
            Isolated Sandbox Judge
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Linux cgroups v2, custom seccomp syscall filtering, and zero-network
            execution prevent security risks while ensuring deterministic
            runtimes.
          </p>
        </div>

        <div className="p-7 rounded-2xl bg-gradient-to-b from-[#111622] to-[#0d121c] border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-teal-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">
            Asynchronous BullMQ Queue
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Submissions are decoupled from web traffic and processed through
            Redis queues with live Server-Sent Events (SSE) verdict streaming.
          </p>
        </div>

        <div className="p-7 rounded-2xl bg-gradient-to-b from-[#111622] to-[#0d121c] border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">
            Database-Backed Sessions
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Argon2id password hashing, cryptographically random session tokens,
            and strict HttpOnly cookie protections keep accounts secure.
          </p>
        </div>
      </div>

      {/* Language Support Banner */}
      <div className="w-full p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm block">
              MVP Supported Compilers &amp; Runtimes
            </span>
            <span className="text-xs text-slate-400">
              GCC C++20, Python 3.12, Node.js 20 TypeScript/JS
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {MVP_LANGUAGES.map((lang) => (
            <span
              key={lang}
              className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800/90 text-slate-200 border border-slate-700"
            >
              {lang}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
