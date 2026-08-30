"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Language } from "@codearena/db";
import {
  ProblemDescriptionPanel,
  WorkspaceProblemData,
} from "./ProblemDescriptionPanel";
import { MonacoEditorWrapper } from "./MonacoEditorWrapper";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import { ConsolePanel, ConsoleTab } from "./ConsolePanel";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { useRunCode } from "@/hooks/useRunCode";
import { useSubmitCode } from "@/hooks/useSubmitCode";

interface ProblemWorkspaceProps {
  problem: WorkspaceProblemData;
}

export function ProblemWorkspace({ problem }: ProblemWorkspaceProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    Language.PYTHON,
  );

  // Initialize boilerplate dictionary from problem templates
  const getInitialBoilerplates = useCallback(() => {
    const map: Record<string, string> = {
      [Language.PYTHON]: "# Write your solution here\n",
      [Language.CPP]:
        "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n",
      [Language.TYPESCRIPT]: "// Write your solution here\n",
    };

    problem.templates.forEach((t) => {
      map[t.language] = t.boilerPlate;
    });

    return map;
  }, [problem.templates]);

  // Code state per language
  const [codeMap, setCodeMap] = useState<Record<string, string>>(
    getInitialBoilerplates(),
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Execution Hooks
  const {
    state: runState,
    result: runResult,
    error: runError,
    run: executeRun,
  } = useRunCode();

  const {
    state: submitState,
    submission,
    error: submitError,
    submit: executeSubmit,
  } = useSubmitCode();

  // Console state
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [activeConsoleTab, setActiveConsoleTab] = useState<ConsoleTab>("input");
  const [consoleInput, setConsoleInput] = useState<string>(
    problem.testCases.find((tc) => tc.isSample)?.inputData || "",
  );

  // Auto-switch tabs based on execution progress
  useEffect(() => {
    if (runState === "submitting" || runState === "polling") {
      setIsConsoleOpen(true);
      setActiveConsoleTab("output");
    } else if (runState === "done") {
      setIsConsoleOpen(true);
      if (
        runResult &&
        (runResult.isCompilationError ||
          runResult.isRuntimeError ||
          runResult.stderr)
      ) {
        setActiveConsoleTab("errors");
      } else {
        setActiveConsoleTab("output");
      }
    } else if (runState === "error") {
      setIsConsoleOpen(true);
      setActiveConsoleTab("errors");
    }
  }, [runState, runResult]);

  useEffect(() => {
    if (
      submitState === "submitting" ||
      submitState === "queued" ||
      submitState === "running" ||
      submitState === "completed"
    ) {
      setIsConsoleOpen(true);
      setActiveConsoleTab("result");
    } else if (submitState === "error") {
      setIsConsoleOpen(true);
      setActiveConsoleTab("errors");
    }
  }, [submitState]);

  // Local Storage Draft Persistence
  const getStorageKey = useCallback(
    (lang: Language) => `codearena:draft:${problem.slug}:${lang}`,
    [problem.slug],
  );

  // On mount: Restore draft from localStorage if available
  useEffect(() => {
    try {
      const initialCodeMap = getInitialBoilerplates();
      const updatedCodeMap = { ...initialCodeMap };

      // Check saved language preference
      const savedLang = localStorage.getItem(
        `codearena:last_lang:${problem.slug}`,
      );
      if (
        savedLang &&
        Object.values(Language).includes(savedLang as Language)
      ) {
        setSelectedLanguage(savedLang as Language);
      }

      // Check draft for each language
      Object.values(Language).forEach((lang) => {
        const savedDraft = localStorage.getItem(
          getStorageKey(lang as Language),
        );
        if (savedDraft) {
          updatedCodeMap[lang] = savedDraft;
        }
      });

      setCodeMap(updatedCodeMap);
    } catch {
      // Ignore localStorage errors in restricted environments
    } finally {
      setIsInitialized(true);
    }
  }, [problem.slug, getInitialBoilerplates, getStorageKey]);

  // Save draft whenever code changes
  const handleCodeChange = (newCode: string | undefined) => {
    const code = newCode || "";
    setCodeMap((prev) => ({ ...prev, [selectedLanguage]: code }));

    try {
      localStorage.setItem(getStorageKey(selectedLanguage), code);
    } catch {
      // Ignore storage write errors
    }
  };

  // Language selection change
  const handleSelectLanguage = (lang: Language) => {
    setSelectedLanguage(lang);
    try {
      localStorage.setItem(`codearena:last_lang:${problem.slug}`, lang);
    } catch {
      // Ignore storage errors
    }
  };

  // Reset code action
  const handleResetCode = () => {
    const boilerplates = getInitialBoilerplates();
    const defaultTemplate = boilerplates[selectedLanguage] || "";
    const currentCode = codeMap[selectedLanguage] || "";

    if (currentCode.trim() !== defaultTemplate.trim()) {
      const confirmed = window.confirm(
        "Are you sure you want to reset your code? Your unsaved changes in this language will be discarded.",
      );
      if (!confirmed) return;
    }

    setCodeMap((prev) => ({ ...prev, [selectedLanguage]: defaultTemplate }));
    try {
      localStorage.removeItem(getStorageKey(selectedLanguage));
    } catch {
      // Ignore storage errors
    }
  };

  // Real Run Code behavior
  const handleRunCode = () => {
    const currentCode = codeMap[selectedLanguage] || "";

    if (!currentCode.trim()) {
      setIsConsoleOpen(true);
      setActiveConsoleTab("errors");
      return;
    }

    executeRun({
      problemId: problem.id,
      language: selectedLanguage,
      sourceCode: currentCode,
      stdin: consoleInput,
    });
  };

  // Real Submit Code behavior
  const handleSubmitCode = () => {
    const currentCode = codeMap[selectedLanguage] || "";

    if (!currentCode.trim()) {
      setIsConsoleOpen(true);
      setActiveConsoleTab("errors");
      return;
    }

    executeSubmit({
      problemId: problem.id,
      language: selectedLanguage,
      sourceCode: currentCode,
    });
  };

  const currentMonacoLang =
    SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage)?.monacoLang ||
    "python";

  const isRunning = runState === "submitting" || runState === "polling";
  const isSubmitting =
    submitState === "submitting" ||
    submitState === "queued" ||
    submitState === "running";

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0d14]">
      {/* Left Panel: Problem Description (50% on desktop) */}
      <div className="w-full lg:w-1/2 h-1/2 lg:h-full p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#0a0d14] overflow-hidden flex flex-col">
        <ProblemDescriptionPanel problem={problem} />
      </div>

      {/* Right Panel: Monaco IDE + Toolbar + Console (50% on desktop) */}
      <div className="w-full lg:w-1/2 h-1/2 lg:h-full flex flex-col bg-[#0e121d] overflow-hidden">
        {/* Editor Toolbar */}
        <WorkspaceToolbar
          selectedLanguage={selectedLanguage}
          onSelectLanguage={handleSelectLanguage}
          onResetCode={handleResetCode}
          onRunCode={handleRunCode}
          onSubmitCode={handleSubmitCode}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          isRunDisabled={!isInitialized}
          isSubmitDisabled={!isInitialized}
        />

        {/* Monaco Editor Container */}
        <div className="flex-1 min-h-[200px] relative overflow-hidden">
          <MonacoEditorWrapper
            language={currentMonacoLang}
            value={codeMap[selectedLanguage] || ""}
            onChange={handleCodeChange}
          />
        </div>

        {/* Bottom Console Panel */}
        <ConsolePanel
          isOpen={isConsoleOpen}
          onToggleOpen={() => setIsConsoleOpen(!isConsoleOpen)}
          activeTab={activeConsoleTab}
          onSelectTab={setActiveConsoleTab}
          inputValue={consoleInput}
          onInputChange={setConsoleInput}
          runState={runState}
          runResult={runResult}
          runError={runError}
          submitState={submitState}
          submission={submission}
          submitError={submitError}
        />
      </div>
    </div>
  );
}
