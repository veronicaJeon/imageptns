"use client";

import { useCallback, useEffect, useState } from "react";

interface GuidanceMessage {
  id: string;
  content_ko: string;
  content_en: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = { content_ko: "", content_en: "", is_active: true };

export default function AdminLibraryGuidancePage() {
  const [messages, setMessages] = useState<GuidanceMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/library-guidance");
      if (response.status === 403) { setForbidden(true); return; }
      const body = await response.json() as { messages?: GuidanceMessage[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "안내글을 불러오지 못했습니다.");
      setMessages(body.messages ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "안내글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(message: GuidanceMessage) {
    setEditingId(message.id);
    setForm({ content_ko: message.content_ko, content_en: message.content_en ?? "", is_active: message.is_active });
    setFormOpen(true);
  }

  async function saveMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!form.content_ko.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/admin/library-guidance/${editingId}` : "/api/admin/library-guidance", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "안내글을 저장하지 못했습니다.");
      setFormOpen(false);
      await loadMessages();
    } catch (error) {
      alert(error instanceof Error ? error.message : "안내글을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(message: GuidanceMessage) {
    await fetch(`/api/admin/library-guidance/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !message.is_active }),
    });
    await loadMessages();
  }

  async function deleteMessage(message: GuidanceMessage) {
    if (!confirm(`안내글 “${message.content_ko}”을 삭제하시겠습니까?`)) return;
    const response = await fetch(`/api/admin/library-guidance/${message.id}`, { method: "DELETE" });
    if (!response.ok) { alert("안내글을 삭제하지 못했습니다."); return; }
    await loadMessages();
  }

  if (forbidden) return <div className="p-10 text-center font-bold text-error">관리자 권한이 필요합니다.</div>;

  return (
    <div className="p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl font-extrabold text-on-surface">안내글 관리</h1>
            <p className="mt-1 text-sm text-outline">활성 안내글 중 하나가 라이브러리를 새로 열 때마다 무작위로 노출됩니다.</p>
          </div>
          <button onClick={openNew} className="flex shrink-0 items-center gap-2 rounded bg-primary px-4 py-2.5 text-xs font-bold text-white">
            <span className="material-symbols-outlined text-base">add</span>안내글 추가
          </button>
        </div>

        {loading ? <div className="py-24 text-center text-outline">불러오는 중...</div> : (
          <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-ghost">
            {messages.length === 0 ? <p className="py-24 text-center text-outline">등록된 안내글이 없습니다.</p> : messages.map((message) => (
              <div key={message.id} className="flex items-start gap-4 border-b border-outline-variant/20 p-5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${message.is_active ? "bg-primary/10 text-primary" : "bg-surface-container text-outline"}`}>
                      {message.is_active ? "노출 중" : "숨김"}
                    </span>
                  </div>
                  <p className="font-semibold text-on-surface">{message.content_ko}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{message.content_en || "영문 안내 없음"}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => toggleActive(message)} className="rounded-lg p-2 text-outline hover:bg-surface-container" title={message.is_active ? "숨기기" : "노출하기"}>
                    <span className="material-symbols-outlined text-lg">{message.is_active ? "visibility_off" : "visibility"}</span>
                  </button>
                  <button onClick={() => openEdit(message)} className="rounded-lg p-2 text-outline hover:bg-surface-container" aria-label="수정"><span className="material-symbols-outlined text-lg">edit</span></button>
                  <button onClick={() => deleteMessage(message)} className="rounded-lg p-2 text-outline hover:bg-error/10 hover:text-error" aria-label="삭제"><span className="material-symbols-outlined text-lg">delete</span></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveMessage} className="w-full max-w-lg space-y-5 rounded-2xl bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{editingId ? "안내글 수정" : "안내글 추가"}</h2><button type="button" onClick={() => setFormOpen(false)}><span className="material-symbols-outlined">close</span></button></div>
            <label className="block text-xs font-bold text-outline">한국어 안내글 *<textarea required maxLength={160} rows={3} value={form.content_ko} onChange={(event) => setForm((current) => ({ ...current, content_ko: event.target.value }))} className="mt-2 w-full rounded-lg bg-surface-container p-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary" /></label>
            <label className="block text-xs font-bold text-outline">영문 안내글<textarea maxLength={160} rows={3} value={form.content_en} onChange={(event) => setForm((current) => ({ ...current, content_en: event.target.value }))} className="mt-2 w-full rounded-lg bg-surface-container p-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="accent-primary" />즉시 노출</label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-outline-variant px-4 py-2.5 text-xs font-bold">취소</button><button disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
