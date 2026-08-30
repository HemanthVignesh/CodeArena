"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Problem, Difficulty } from "@codearena/db";
import { Save, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface EditProblemFormProps {
  problem: Problem;
  initialTags: string;
}

export function EditProblemForm({
  problem,
  initialTags,
}: EditProblemFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(problem.title);
  const [slug, setSlug] = useState(problem.slug);
  const [difficulty, setDifficulty] = useState<Difficulty>(problem.difficulty);
  const [statement, setStatement] = useState(problem.statement);
  const [inputFormat, setInputFormat] = useState(problem.inputFormat || "");
  const [outputFormat, setOutputFormat] = useState(problem.outputFormat || "");
  const [constraints, setConstraints] = useState(problem.constraints || "");
  const [timeLimitMs, setTimeLimitMs] = useState(problem.timeLimitMs);
  const [memoryLimitMb, setMemoryLimitMb] = useState(problem.memoryLimitMb);
  const [tags, setTags] = useState(initialTags);
  const [isPublished, setIsPublished] = useState(problem.isPublished);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug.trim())) {
      setError(
        "Slug must contain only lowercase letters, numbers, and hyphens.",
      );
      return;
    }
    if (!statement.trim()) {
      setError("Statement is required.");
      return;
    }

    setIsLoading(true);

    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/problems/${problem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim().toLowerCase(),
          difficulty,
          statement: statement.trim(),
          inputFormat: inputFormat.trim(),
          outputFormat: outputFormat.trim(),
          constraints: constraints.trim(),
          timeLimitMs: Number(timeLimitMs),
          memoryLimitMb: Number(memoryLimitMb),
          isPublished,
          tags: parsedTags,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update problem.");
        setIsLoading(false);
        return;
      }

      setSuccess("Problem updated successfully!");
      setIsLoading(false);
      router.refresh();
    } catch (err) {
      console.error("Update problem error:", err);
      setError("Network error while updating problem.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-400 text-sm animate-in fade-in"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-400 text-sm animate-in fade-in"
          role="alert"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="p-6 rounded-2xl bg-[#0f1420]/90 border border-slate-800 shadow-xl space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Problem Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              URL Slug *
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Difficulty *
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Time Limit (ms) *
            </label>
            <input
              type="number"
              min={100}
              max={10000}
              value={timeLimitMs}
              onChange={(e) => setTimeLimitMs(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Memory Limit (MB) *
            </label>
            <input
              type="number"
              min={16}
              max={2048}
              value={memoryLimitMb}
              onChange={(e) => setMemoryLimitMb(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Problem Statement *
          </label>
          <textarea
            rows={6}
            required
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Input Format
            </label>
            <textarea
              rows={3}
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Output Format
            </label>
            <textarea
              rows={3}
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Constraints
          </label>
          <textarea
            rows={3}
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
          />
          <label
            htmlFor="isPublished"
            className="text-sm font-medium text-slate-200"
          >
            Published (visible to all users in problem catalog)
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/problems"
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
