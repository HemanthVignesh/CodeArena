"use client";

import React, { useState } from "react";
import { Difficulty } from "@codearena/db";
import { Clock, HardDrive, Copy, Check, Terminal, Layers } from "lucide-react";

export interface WorkspaceProblemData {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  acceptanceRate: number | null;
  isPublished: boolean;
  tags: { id: string; name: string; slug: string }[];
  testCases: {
    id: string;
    inputData: string;
    expectedOutput: string;
    isSample: boolean;
    orderIndex: number;
    explanation: string | null;
  }[];
  templates: {
    id: string;
    language: string;
    boilerPlate: string;
  }[];
}

interface ProblemDescriptionPanelProps {
  problem: WorkspaceProblemData;
}

export function ProblemDescriptionPanel({
  problem,
}: ProblemDescriptionPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    <div className="h-full overflow-y-auto pr-2 space-y-6 text-sm text-slate-300 leading-relaxed scrollbar-thin">
      {/* Problem Header */}
      <div className="p-5 rounded-2xl bg-[#0f1420]/80 border border-slate-800/80 shadow-lg">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyBadge(
              problem.difficulty,
            )}`}
          >
            {problem.difficulty}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{problem.timeLimitMs} ms</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>{problem.memoryLimitMb} MB</span>
          </div>
          {problem.acceptanceRate !== null && (
            <div className="text-xs text-slate-400 font-mono">
              Acceptance:{" "}
              <span className="text-emerald-400">
                {problem.acceptanceRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-3">
          {problem.title}
        </h1>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map((t) => (
            <span
              key={t.id}
              className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 text-xs font-medium border border-slate-800"
            >
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {/* Statement Card */}
      <div className="p-5 rounded-2xl bg-[#0f1420]/80 border border-slate-800/80 shadow-lg space-y-6">
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Description
          </h2>
          <div className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
            {problem.statement}
          </div>
        </div>

        {/* Input & Output Format */}
        {problem.inputFormat && (
          <div className="space-y-2 pt-4 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Input Format
            </h2>
            <div className="whitespace-pre-wrap text-slate-300 font-mono text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {problem.inputFormat}
            </div>
          </div>
        )}

        {problem.outputFormat && (
          <div className="space-y-2 pt-4 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Output Format
            </h2>
            <div className="whitespace-pre-wrap text-slate-300 font-mono text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {problem.outputFormat}
            </div>
          </div>
        )}

        {/* Constraints */}
        {problem.constraints && (
          <div className="space-y-2 pt-4 border-t border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Constraints
            </h2>
            <div className="whitespace-pre-wrap text-slate-300 font-mono text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {problem.constraints}
            </div>
          </div>
        )}

        {/* Sample Test Cases */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Sample Cases
          </h2>
          {problem.testCases.map((tc, index) => (
            <div
              key={tc.id}
              className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-4 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="font-mono">Example {index + 1}</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-slate-500 uppercase">
                    Input
                  </span>
                  <button
                    onClick={() => copyToClipboard(tc.inputData, `in-${tc.id}`)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                    title="Copy Input"
                  >
                    {copiedId === `in-${tc.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-900/90 text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800/60">
                  {tc.inputData}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-slate-500 uppercase">
                    Expected Output
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(tc.expectedOutput, `out-${tc.id}`)
                    }
                    className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                    title="Copy Output"
                  >
                    {copiedId === `out-${tc.id}` ? (
                      <Check className="w-3.5 h-3.5 text-teal-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-900/90 text-teal-300 font-mono text-xs overflow-x-auto border border-slate-800/60">
                  {tc.expectedOutput}
                </pre>
              </div>

              {tc.explanation && (
                <div className="text-xs text-slate-400 pt-1">
                  <span className="font-semibold text-slate-300">
                    Explanation:{" "}
                  </span>
                  {tc.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
