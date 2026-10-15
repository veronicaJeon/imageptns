"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n/store";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface Notice {
  id: string;
  title: string;
  body: string;
}

const NOTICE_POPUP_COPY = {
  ko: { hideToday: "오늘 하루 보지 않기", confirm: "확인" },
  en: { hideToday: "Do not show again today", confirm: "OK" },
} as const;

function isDismissedToday(noticeId: string): boolean {
  try {
    const val = localStorage.getItem(`notice_dismissed_${noticeId}`);
    if (!val) return false;
    const dismissedAt = new Date(val);
    const now = new Date();
    const diffMs = now.getTime() - dismissedAt.getTime();
    return diffMs < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function NoticePopup() {
  const { lang } = useLang();
  const copy = NOTICE_POPUP_COPY[lang];
  const [notice, setNotice] = useState<Notice | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/notices?popup=1")
      .then((r) => r.json())
      .then(({ notices }) => {
        const n = notices?.[0];
        if (!n) return;
        if (isDismissedToday(n.id)) return;
        setNotice(n);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  function dismiss(hideForDay = false) {
    if (notice && hideForDay) {
      try {
        localStorage.setItem(`notice_dismissed_${notice.id}`, new Date().toISOString());
      } catch {}
    }
    setVisible(false);
  }

  if (!notice) return null;

  return (
    <Dialog
      open={visible}
      onClose={dismiss}
      size="compact"
      placement="center"
      density="compact"
      chrome="seamless"
      title={notice.title}
      closeLabel={lang === "ko" ? "공지 닫기" : "Close notice"}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(true)} className="-ml-4 min-h-11 px-4 text-xs font-medium">
            {copy.hideToday}
          </Button>
          <Button type="button" onClick={() => dismiss()} className="min-w-24">{copy.confirm}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {notice.body.trim().split(/\n\s*\n/).map((paragraph, index) => (
          <p key={index} className="break-words text-[15px] leading-7 text-on-surface-variant">
            {paragraph.replace(/\s*\n\s*/g, " ")}
          </p>
        ))}
      </div>
    </Dialog>
  );
}
