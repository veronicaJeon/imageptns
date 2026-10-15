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
  ko: { title: "공지사항", hideToday: "오늘 하루 보지 않기", confirm: "확인" },
  en: { title: "Notices", hideToday: "Do not show again today", confirm: "OK" },
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
  const [hideForDay, setHideForDay] = useState(false);

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

  function dismiss() {
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
      eyebrow={copy.title}
      title={notice.title}
      closeLabel={lang === "ko" ? "공지 닫기" : "Close notice"}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 sm:justify-start">
            <input
              type="checkbox"
              checked={hideForDay}
              onChange={(e) => setHideForDay(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-xs text-on-surface-variant">{copy.hideToday}</span>
          </label>
          <Button type="button" onClick={dismiss} className="w-full sm:w-auto sm:min-w-24">{copy.confirm}</Button>
        </div>
      }
    >
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-on-surface-variant">{notice.body}</p>
    </Dialog>
  );
}
