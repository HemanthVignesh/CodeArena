"use client";

import React from "react";
import { Language } from "@codearena/db";
import { ChevronDown, Code2 } from "lucide-react";

import { SUPPORTED_LANGUAGES } from "@/lib/languages";

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  disabled = false,
}: LanguageSelectorProps) {
  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-600 transition-colors">
        <Code2 className="w-3.5 h-3.5 text-emerald-400" />
        <select
          value={selectedLanguage}
          onChange={(e) => onSelectLanguage(e.target.value as Language)}
          disabled={disabled}
          aria-label="Programming Language Selector"
          className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer pr-4 appearance-none"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option
              key={lang.id}
              value={lang.id}
              className="bg-slate-900 text-slate-200"
            >
              {lang.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none -ml-4" />
      </div>
    </div>
  );
}
