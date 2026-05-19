"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "imageptns.activitySessionId";
const PRESENCE_INTERVAL_MS = 30_000;

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

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const sendPresence = () => {
      const search = searchParams.toString();
      const path = search ? `${pathname}?${search}` : pathname;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId(),
          path,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    sendPresence();
    const interval = window.setInterval(sendPresence, PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [pathname, searchParams]);

  return null;
}
