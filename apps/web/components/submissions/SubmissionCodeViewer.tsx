"use client";

import React, { useState } from "react";
import { MonacoEditorWrapper } from "@/components/workspace/MonacoEditorWrapper";
import { Copy, Check, Code2 } from "lucide-react";

interface SubmissionCodeViewerProps {
  code: string;
  language: string;
  monacoLang: string;
}

export function SubmissionCodeViewer({
  code,
  language,
  monacoLang,
}: SubmissionCodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  const lineCount = code.split("\n").length;
  const byteSize = new Blob([code]).size;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0e1320] overflow-hidden shadow-xl shadow-black/20 flex flex-col">
      {/* Code Viewer Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e121d] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-slate-800 text-slate-400">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">
            Submitted Source Code
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-900 border border-slate-800 text-slate-400">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-500">
            {lineCount} {lineCount === 1 ? "line" : "lines"} ({byteSize} bytes)
          </span>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            title="Copy Source Code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Read-Only Editor */}
      <div className="h-[420px] relative">
        <MonacoEditorWrapper
          language={monacoLang}
          value={code}
          onChange={() => {}} // Read-only
          readOnly={true}
        />
      </div>
    </div>
  );
}
