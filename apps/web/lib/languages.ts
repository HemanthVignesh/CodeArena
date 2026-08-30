import { Language } from "@codearena/db";

export interface LanguageOption {
  id: Language;
  name: string;
  monacoLang: string;
  extension: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    id: Language.PYTHON,
    name: "Python 3.12",
    monacoLang: "python",
    extension: ".py",
  },
  {
    id: Language.CPP,
    name: "C++20 (GCC)",
    monacoLang: "cpp",
    extension: ".cpp",
  },
  {
    id: Language.TYPESCRIPT,
    name: "TypeScript (Node 20)",
    monacoLang: "typescript",
    extension: ".ts",
  },
];
