"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n/store";

export function LangHydrator() {
  useEffect(() => {
    if (!useLang.persist.hasHydrated()) {
      void useLang.persist.rehydrate();
    }
  }, []);

  return null;
}
