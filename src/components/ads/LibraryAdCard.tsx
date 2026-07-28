"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import type { PublicLibraryAd } from "@/lib/ads/campaigns";

const SESSION_KEY = "imageptns.activitySessionId";

function activitySessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return null;
  }
}

function recordAdEvent(campaign: PublicLibraryAd, eventType: "ad_impression" | "ad_click") {
  const payload = JSON.stringify({
    eventType,
    sessionId: activitySessionId(),
    path: window.location.pathname,
    metadata: {
      campaignId: campaign.id,
      campaignType: campaign.campaignType,
      placement: campaign.placement,
    },
  });

  if (eventType === "ad_click") {
    const sent = navigator.sendBeacon?.(
      "/api/events",
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return;
  }

  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function LibraryAdCard({ campaign }: { campaign: PublicLibraryAd }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const impressionRecordedRef = useRef(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || impressionRecordedRef.current) return;
    let visibleTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some(
        (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
      );
      if (!visible) {
        if (visibleTimer) clearTimeout(visibleTimer);
        visibleTimer = null;
        return;
      }
      if (visibleTimer) return;
      visibleTimer = setTimeout(() => {
        impressionRecordedRef.current = true;
        recordAdEvent(campaign, "ad_impression");
        observer.disconnect();
      }, 1000);
    }, { threshold: [0, 0.5, 1] });

    observer.observe(card);
    return () => {
      observer.disconnect();
      if (visibleTimer) clearTimeout(visibleTimer);
    };
  }, [campaign]);

  const external = !campaign.destinationUrl.startsWith("/");

  return (
    <aside
      ref={cardRef}
      className="hidden self-start overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-ghost 2xl:block"
      aria-label={campaign.label}
    >
      {campaign.imageUrl && (
        <div className="aspect-[4/3] overflow-hidden bg-surface-container">
          <img
            src={campaign.imageUrl}
            alt={campaign.imageAlt}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
            {campaign.label}
          </span>
          {campaign.sponsorName && (
            <span className="max-w-full truncate text-[10px] font-semibold text-outline">
              {campaign.sponsorName}
            </span>
          )}
        </div>
        <h2 className="mt-3 font-headline text-lg font-extrabold leading-snug text-on-surface">
          {campaign.title}
        </h2>
        {campaign.body && (
          <p className="mt-2 text-xs leading-5 text-on-surface-variant">
            {campaign.body}
          </p>
        )}
        <a
          href={campaign.destinationUrl}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer sponsored" : undefined}
          onClick={() => recordAdEvent(campaign, "ad_click")}
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-primary/90"
        >
          {campaign.cta}
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            {external ? "open_in_new" : "arrow_forward"}
          </span>
        </a>
      </div>
    </aside>
  );
}
