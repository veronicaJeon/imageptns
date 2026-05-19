"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "imageptns.activitySessionId";

function sessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function ActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const search = searchParams.toString();
    const path = search ? `${pathname}?${search}` : pathname;

    const payload = JSON.stringify({
      eventType: "page_view",
      sessionId: sessionId(),
      path,
    });

    const sent = navigator.sendBeacon?.(
      "/api/events",
      new Blob([
        payload,
      ], { type: "application/json" }),
    );

    if (!sent) {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname, searchParams]);

  return null;
}
