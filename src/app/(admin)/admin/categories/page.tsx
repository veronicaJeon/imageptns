"use client";

import { useEffect, useState } from "react";
import type { ImageCategory } from "@/lib/images/categories";

interface EditableCategory extends ImageCategory {
  sort_order: number;
  active: boolean;
}

const EMPTY_FORM = {
  code: "",
  ko: "",
  en: "",
  sort_order: 1000,
  active: true,
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<EditableCategory[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "카테고리를 불러오지 못했습니다.");
      setCategories((data.categories ?? []).map((category: ImageCategory) => ({
        ...category,
        sort_order: category.sort_order ?? 1000,
        active: category.active !== false,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "카테고리를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function updateCategory(code: string, patch: Partial<EditableCategory>) {
    setCategories((current) => current.map((category) => (
      category.code === code ? { ...category, ...patch } : category
    )));
  }

  async function saveCategory(category: EditableCategory) {
    setSavingCode(category.code);
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(category.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "저장하지 못했습니다.");
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSavingCode(null);
    }
  }

  async function createCategory() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "카테고리를 만들지 못했습니다.");
      setForm(EMPTY_FORM);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "카테고리를 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-4 md:p-10">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-semibold text-primary">카테고리 구조</p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">카테고리 관리</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <section className="mb-8 rounded-lg bg-surface-container-lowest p-4 shadow-ghost">
        <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_1.3fr_120px_auto]">
          <input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.trim().toLowerCase() })}
            placeholder="code"
            className="h-11 rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <input
            value={form.ko}
            onChange={(event) => setForm({ ...form, ko: event.target.value })}
            placeholder="한글 라벨"
            className="h-11 rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <input
            value={form.en}
            onChange={(event) => setForm({ ...form, en: event.target.value })}
            placeholder="English label"
            className="h-11 rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <input
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
            className="h-11 rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={createCategory}
            disabled={creating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">add</span>
            추가
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg bg-surface-container-lowest shadow-ghost">
        <div className="hidden grid-cols-[120px_1fr_1fr_100px_90px_92px] gap-3 border-b border-outline-variant/30 px-4 py-3 text-[11px] font-semibold text-outline md:grid">
          <span>Code</span>
          <span>한글</span>
          <span>English</span>
          <span>순서</span>
          <span>상태</span>
          <span>저장</span>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : categories.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-outline">카테고리가 없습니다.</div>
        ) : categories.map((category) => (
          <div key={category.code} className="grid gap-3 border-b border-outline-variant/20 p-4 last:border-b-0 md:grid-cols-[120px_1fr_1fr_100px_90px_92px] md:px-4 md:py-3">
            <div className="flex items-center justify-between gap-3 md:block">
              <span className="text-xs font-semibold text-outline md:hidden">Code</span>
              <span className="font-mono text-xs text-on-surface">{category.code}</span>
            </div>
            <label className="grid gap-1.5 md:block">
              <span className="text-xs font-semibold text-outline md:hidden">한글</span>
              <input
                value={category.ko}
                onChange={(event) => updateCategory(category.code, { ko: event.target.value })}
                className="h-10 w-full rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="grid gap-1.5 md:block">
              <span className="text-xs font-semibold text-outline md:hidden">English</span>
              <input
                value={category.en}
                onChange={(event) => updateCategory(category.code, { en: event.target.value })}
                className="h-10 w-full rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="grid gap-1.5 md:block">
              <span className="text-xs font-semibold text-outline md:hidden">순서</span>
              <input
                type="number"
                value={category.sort_order}
                onChange={(event) => updateCategory(category.code, { sort_order: Number(event.target.value) })}
                className="h-10 w-full rounded bg-surface-container-low px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 md:contents">
              <button
                type="button"
                onClick={() => updateCategory(category.code, { active: !category.active })}
                className={`inline-flex h-10 items-center justify-center rounded-full border px-3 text-xs font-semibold ${category.active ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-outline"}`}
              >
                {category.active ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => saveCategory(category)}
                disabled={savingCode === category.code}
                className="inline-flex h-10 items-center justify-center rounded bg-on-surface px-3 text-xs font-semibold text-surface disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
