"use client";

import { useState, useEffect } from "react";

interface Notice {
  id: string;
  title: string;
  body: string;
  is_popup: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export default function AdminNoticesPage() {
  const [notices, setNotices]   = useState<Notice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fTitle, setFTitle]         = useState("");
  const [fBody, setFBody]           = useState("");
  const [fIsPopup, setFIsPopup]     = useState(false);
  const [fPublished, setFPublished] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);

  async function loadNotices() {
    setLoading(true);
    try {
      // Admin needs all notices (published + draft) — use admin endpoint variant
      const res = await fetch("/api/admin/notices");
      if (res.status === 403) { setForbidden(true); return; }
      const { notices: n } = await res.json();
      setNotices(n ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNotices(); }, []);

  function openNew() {
    setEditId(null);
    setFTitle(""); setFBody(""); setFIsPopup(false); setFPublished(false);
    setShowForm(true);
  }

  function openEdit(n: Notice) {
    setEditId(n.id);
    setFTitle(n.title); setFBody(n.body); setFIsPopup(n.is_popup); setFPublished(n.is_published);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fTitle.trim() || !fBody.trim()) return;
    setSaving(true);
    try {
      const body = { title: fTitle.trim(), body: fBody.trim(), is_popup: fIsPopup, is_published: fPublished };
      const res = editId
        ? await fetch(`/api/notices/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowForm(false);
        await loadNotices();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
    await fetch(`/api/notices/${id}`, { method: "DELETE" });
    await loadNotices();
  }

  async function togglePublish(n: Notice) {
    await fetch(`/api/notices/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !n.is_published }),
    });
    await loadNotices();
  }

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-5xl">lock</span>
        <p className="font-bold">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">공지사항 관리</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">add</span>
            새 공지 작성
          </button>
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-lg font-extrabold text-on-surface">
                  {editId ? "공지사항 수정" : "새 공지사항"}
                </h2>
                <button type="button" onClick={() => setShowForm(false)}>
                  <span className="material-symbols-outlined text-xl text-outline hover:text-on-surface">close</span>
                </button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">제목 *</label>
                  <input
                    type="text" required value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                    placeholder="공지 제목"
                    className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">내용 *</label>
                  <textarea
                    required value={fBody} onChange={(e) => setFBody(e.target.value)}
                    rows={6} placeholder="공지 내용을 입력하세요"
                    className="bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={fIsPopup} onChange={(e) => setFIsPopup(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm text-on-surface">메인 팝업으로 표시</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox" checked={fPublished} onChange={(e) => setFPublished(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm text-on-surface">즉시 게시</span>
                  </label>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 text-xs font-bold text-on-surface-variant border border-outline-variant rounded-lg hover:border-outline transition-colors">
                    취소
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all">
                    {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {editId ? "수정 저장" : "게시하기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-24">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-3 text-outline">
            <span className="material-symbols-outlined text-5xl">campaign</span>
            <p className="text-sm">공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl shadow-ghost overflow-hidden">
            {notices.map((n, idx) => (
              <div key={n.id} className={["px-5 py-4 flex items-start gap-4", idx < notices.length - 1 ? "border-b border-outline-variant/20" : ""].join(" ")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.is_popup && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">팝업</span>
                    )}
                    <span className={["text-[10px] font-bold px-2 py-0.5 rounded-full", n.is_published ? "text-green-700 bg-green-100" : "text-outline bg-surface-container"].join(" ")}>
                      {n.is_published ? "게시중" : "미게시"}
                    </span>
                    <span className="text-[10px] text-outline">
                      {new Date(n.published_at ?? n.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{n.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePublish(n)}
                    title={n.is_published ? "게시 중단" : "게시하기"}
                    className="p-2 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {n.is_published ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                  <button onClick={() => openEdit(n)}
                    className="p-2 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button onClick={() => handleDelete(n.id)}
                    className="p-2 rounded-lg hover:bg-error/10 text-outline hover:text-error transition-colors">
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
