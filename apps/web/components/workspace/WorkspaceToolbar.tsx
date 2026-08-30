"use client";

import React from "react";
import { Language } from "@codearena/db";
import { LanguageSelector } from "./LanguageSelector";
import { RotateCcw, Play, Send, Loader2 } from "lucide-react";

interface WorkspaceToolbarProps {
  selectedLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  onResetCode: () => void;
  onRunCode: () => void;
  onSubmitCode: () => void;
  isRunning?: boolean;
  isSubmitting?: boolean;
  isRunDisabled?: boolean;
  isSubmitDisabled?: boolean;
}

export function WorkspaceToolbar({
  selectedLanguage,
  onSelectLanguage,
  onResetCode,
  onRunCode,
  onSubmitCode,
  isRunning = false,
  isSubmitting = false,
  isRunDisabled = false,
  isSubmitDisabled = false,
}: WorkspaceToolbarProps) {
  const disableRun = isRunDisabled || isRunning || isSubmitting;
  const disableSubmit = isSubmitDisabled || isRunning || isSubmitting;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0e121d] border-b border-slate-800">
      {/* Left Toolbar Controls */}
      <div className="flex items-center gap-2">
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onSelectLanguage={onSelectLanguage}
        />

        <button
          onClick={onResetCode}
          disabled={isRunning || isSubmitting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Reset Code to Template Boilerplate"
          aria-label="Reset Code to Boilerplate"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2">
        {/* Run Code Button */}
        <button
          onClick={onRunCode}
          disabled={disableRun}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          title="Run Code with Custom Input"
          aria-label="Run Code"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
          ) : (
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          )}
          <span>{isRunning ? "Running..." : "Run"}</span>
        </button>

        {/* Submit Code Button */}
        <button
          onClick={onSubmitCode}
          disabled={disableSubmit}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-semibold text-xs text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20"
          title="Submit Code for Judge Verdict"
          aria-label="Submit Code"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isSubmitting ? "Submitting..." : "Submit"}</span>
        </button>
      </div>
    </div>
  );
}
