import { create } from "zustand";
import { persist } from "zustand/middleware";
import { en } from "./en";
import { ko } from "./ko";
import type { Translations } from "./en";

type Lang = "ko" | "en";

interface LangStore {
  lang: Lang;
  t: Translations;
  toggle: () => void;
  setLang: (lang: Lang) => void;
}

export const useLang = create<LangStore>()(
  persist(
    (set) => ({
      lang: "ko",
      t: ko,
      toggle: () =>
        set((s) => {
          const next = s.lang === "ko" ? "en" : "ko";
          return { lang: next, t: next === "ko" ? ko : en };
        }),
      setLang: (lang) => set({ lang, t: lang === "ko" ? ko : en }),
    }),
    { name: "imageptns-lang" }
  )
);
