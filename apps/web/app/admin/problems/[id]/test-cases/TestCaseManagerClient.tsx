"use client";

import React, { useState } from "react";
import { TestCase } from "@codearena/db";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Code2,
} from "lucide-react";

interface TestCaseManagerClientProps {
  problemId: string;
  initialCases: TestCase[];
}

export function TestCaseManagerClient({
  problemId,
  initialCases,
}: TestCaseManagerClientProps) {
  const [testCases, setTestCases] = useState<TestCase[]>(initialCases);
  const [showAddModal, setShowAddModal] = useState(false);

  // New test case state
  const [inputData, setInputData] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [isSample, setIsSample] = useState(false);
  const [isHidden, setIsHidden] = useState(true);
  const [explanation, setExplanation] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inputData && inputData !== "") {
      setError("Input data is required.");
      return;
    }
    if (!expectedOutput && expectedOutput !== "") {
      setError("Expected output is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/admin/problems/${problemId}/test-cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputData,
          expectedOutput,
          isSample,
          isHidden: isSample ? false : isHidden,
          explanation: explanation.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create test case.");
        setIsSubmitting(false);
        return;
      }

      setTestCases((prev) => [...prev, data]);
      setShowAddModal(false);
      setInputData("");
      setExpectedOutput("");
      setIsSample(false);
      setIsHidden(true);
      setExplanation("");
    } catch (err) {
      console.error("Add test case error:", err);
      setError("Network error creating test case.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTestCase = async (caseId: string) => {
    if (!confirm("Are you sure you want to delete this test case?")) return;

    setDeletingId(caseId);
    try {
      const res = await fetch(
        `/api/admin/problems/${problemId}/test-cases/${caseId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete test case.");
        return;
      }

      setTestCases((prev) => prev.filter((tc) => tc.id !== caseId));
    } catch (err) {
      console.error("Delete test case error:", err);
      alert("Network error deleting test case.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="text-sm text-slate-300">
          Total Test Cases:{" "}
          <span className="font-bold text-white font-mono">
            {testCases.length}
          </span>{" "}
          <span className="text-xs text-slate-500 font-mono">
            ({testCases.filter((c) => c.isSample).length} sample,{" "}
            {testCases.filter((c) => c.isHidden).length} hidden)
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Test Case</span>
        </button>
      </div>

      {/* Add Test Case Form/Panel */}
      {showAddModal && (
        <form
          onSubmit={handleAddTestCase}
          className="p-6 rounded-2xl bg-[#0f1420] border border-emerald-500/30 shadow-2xl space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base">New Test Case</h3>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Standard Input (stdin) *
              </label>
              <textarea
                rows={4}
                required
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                placeholder="4&#10;2 7 11 15&#10;9"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-emerald-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Expected Output (stdout) *
              </label>
              <textarea
                rows={4}
                required
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                placeholder="0 1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-teal-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSample}
                  onChange={(e) => {
                    setIsSample(e.target.checked);
                    if (e.target.checked) setIsHidden(false);
                  }}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500"
                />
                <span>Is Sample (Visible to user)</span>
              </label>

              {!isSample && (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHidden}
                    onChange={(e) => setIsHidden(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500"
                  />
                  <span>Is Hidden (Judge only)</span>
                </label>
              )}
            </div>

            <div>
              <input
                type="text"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Optional explanation for sample case..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl font-semibold text-xs text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Create Test Case</span>
            </button>
          </div>
        </form>
      )}

      {/* Test Cases List */}
      <div className="space-y-4">
        {testCases.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-500">
            <Code2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">
              No test cases configured
            </p>
            <p className="text-xs">
              Add sample and hidden test cases for automated judge evaluation.
            </p>
          </div>
        ) : (
          testCases.map((tc, idx) => (
            <div
              key={tc.id}
              className="p-5 rounded-2xl bg-[#0f1420]/90 border border-slate-800 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    #{idx + 1}
                  </span>
                  {tc.isSample ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      <Eye className="w-3 h-3" /> SAMPLE CASE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                      <EyeOff className="w-3 h-3" /> HIDDEN CASE
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteTestCase(tc.id)}
                  disabled={deletingId === tc.id}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                  title="Delete Test Case"
                >
                  {deletingId === tc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                    Input
                  </span>
                  <pre className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-emerald-300 font-mono overflow-x-auto">
                    {tc.inputData}
                  </pre>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                    Expected Output
                  </span>
                  <pre className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-teal-300 font-mono overflow-x-auto">
                    {tc.expectedOutput}
                  </pre>
                </div>
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
          ))
        )}
      </div>
    </div>
  );
}
