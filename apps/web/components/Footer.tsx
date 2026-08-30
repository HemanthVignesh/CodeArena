import React from "react";
import Link from "next/link";
import { Code2, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#090c13] text-slate-400 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">
                CodeArena
              </span>
              <span className="text-xs text-slate-500 block">
                Production Online Judge &amp; Competitive Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/problems"
              className="hover:text-slate-200 transition-colors"
            >
              Problems
            </Link>
            <Link
              href="/login"
              className="hover:text-slate-200 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="hover:text-slate-200 transition-colors"
            >
              Register
            </Link>
            <a
              href="https://github.com/HemanthVignesh/CodeArena"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>
            © {new Date().getFullYear()} CodeArena Platform. All rights
            reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Judge Sandbox Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
