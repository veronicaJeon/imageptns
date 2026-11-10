"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n/store";

export function LangHydrator() {
  const lang = useLang((state) => state.lang);

  useEffect(() => {
    if (!useLang.persist.hasHydrated()) {
      void useLang.persist.rehydrate();
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
