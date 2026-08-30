"use client";

import React from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

interface MonacoEditorWrapperProps {
  language: string;
  value: string;
  onChange: (value: string | undefined) => void;
  onMount?: OnMount;
  readOnly?: boolean;
}

export function MonacoEditorWrapper({
  language,
  value,
  onChange,
  onMount,
  readOnly = false,
}: MonacoEditorWrapperProps) {
  return (
    <div className="w-full h-full min-h-[300px] relative bg-[#1e1e1e]">
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={value}
        theme="vs-dark"
        onChange={onChange}
        onMount={onMount}
        loading={
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 bg-[#1e1e1e]">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs font-mono">
              Initializing Monaco Editor...
            </span>
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily:
            "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
          fontLigatures: true,
          lineNumbers: "on",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: "on",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          contextmenu: true,
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            vertical: "visible",
            horizontal: "visible",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}
