"use client";

import { useEffect, useState } from "react";
import { DEFAULT_AUTH_PAGE_CONTENT, type AuthPageContent } from "./page-content";

export function useAuthPageContent() {
  const [content, setContent] = useState<AuthPageContent>(DEFAULT_AUTH_PAGE_CONTENT);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth-page-content", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (payload?.content) setContent(payload.content); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return content;
}
