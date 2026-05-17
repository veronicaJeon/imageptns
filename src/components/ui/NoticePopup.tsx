"use client";

import { useState, useEffect } from "react";

interface Notice {
  id: string;
  title: string;
  body: string;
}

export function NoticePopup() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/notices?popup=1")
      .then((r) => r.json())
      .then(({ notices }) => {
        const n = notices?.[0];
        if (!n) return;
        // Don't show if dismissed today
        const dismissedKey = `notice_dismissed_${n.id}`;
        if (sessionStorage.getItem(dismissedKey)) return;
        setNotice(n);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    if (notice) sessionStorage.setItem(`notice_dismissed_${notice.id}`, "1");
    setVisible(false);
  }

  if (!visible || !notice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md p-7 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-primary">campaign</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">공지사항</span>
          </div>
          <button type="button" onClick={dismiss} className="text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div>
          <h2 className="font-headline text-lg font-extrabold text-on-surface mb-3">{notice.title}</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{notice.body}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={dismiss}
            className="px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
