"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

type CollectionItem = {
  id: string;
  image_id: string;
  created_at: string;
  image: {
    id: string;
    title: string;
    category: string;
    status: string;
    lifecycle_status?: string | null;
    storage_path_preview: string;
    photographer: { full_name: string } | null;
  } | null;
};

type Collection = {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
  thumbnail: string | null;
};

export default function CollectionsPage() {
  const { lang } = useLang();
  const copy = lang === "ko"
    ? {
        title: "컬렉션",
        newCollection: "새 컬렉션 만들기",
        namePlaceholder: "컬렉션 이름",
        saving: "저장 중…",
        create: "만들기",
        cancel: "취소",
        emptyTitle: "아직 컬렉션이 없습니다",
        emptyBody: "이미지를 그룹으로 정리해 보세요.",
        firstCollection: "첫 컬렉션 만들기",
        itemCount: (count: number) => `${count}개 이미지`,
        confirmDelete: "삭제할까요?",
        delete: "삭제",
        deleteAria: "컬렉션 삭제",
        emptyCollection: "이 컬렉션에 이미지가 없습니다",
        addFromLibrary: "라이브러리에서 추가하기",
        deletedImage: "삭제된 이미지",
        deletedShort: "삭제됨",
        removeAria: "컬렉션에서 제거",
      }
    : {
        title: "Collections",
        newCollection: "New collection",
        namePlaceholder: "Collection name",
        saving: "Saving…",
        create: "Create",
        cancel: "Cancel",
        emptyTitle: "No collections yet",
        emptyBody: "Organize images into groups.",
        firstCollection: "Create first collection",
        itemCount: (count: number) => `${count} image${count === 1 ? "" : "s"}`,
        confirmDelete: "Delete?",
        delete: "Delete",
        deleteAria: "Delete collection",
        emptyCollection: "This collection has no images",
        addFromLibrary: "Add from library",
        deletedImage: "Deleted image",
        deletedShort: "Deleted",
        removeAria: "Remove from collection",
      };
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, CollectionItem[]>>({});
  const [expandedLoading, setExpandedLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then(({ collections: data }) => setCollections(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (creating) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [creating]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const { collection } = await res.json();
    if (collection) {
      setCollections((prev) => [collection, ...prev]);
      setNewName("");
      setCreating(false);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setDeleteTarget(null);
    if (expanded === id) setExpanded(null);
    await fetch(`/api/collections?id=${id}`, { method: "DELETE" });
  }

  async function handleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (expandedItems[id]) return;
    setExpandedLoading(id);
    const res = await fetch(`/api/collections/${id}/items`);
    const { items } = await res.json();
    setExpandedItems((prev) => ({ ...prev, [id]: items ?? [] }));
    setExpandedLoading(null);
  }

  async function handleRemoveItem(collectionId: string, imageId: string) {
    setExpandedItems((prev) => ({
      ...prev,
      [collectionId]: (prev[collectionId] ?? []).filter((i) => i.image_id !== imageId),
    }));
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, item_count: Math.max(0, c.item_count - 1) } : c
      )
    );
    await fetch(`/api/collections/${collectionId}/items?image_id=${imageId}`, { method: "DELETE" });
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
          {copy.title}
          <span className="ml-3 text-sm font-body font-normal text-outline">({collections.length})</span>
        </h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">add</span>
            {copy.newCollection}
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-8 flex items-center gap-3 p-4 bg-surface-container-low border border-outline-variant rounded"
        >
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={copy.namePlaceholder}
            maxLength={80}
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline outline-none border-b border-outline-variant focus:border-primary transition-colors pb-0.5"
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="px-4 py-1.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? copy.saving : copy.create}
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setNewName(""); }}
            className="px-3 py-1.5 text-xs text-outline hover:text-on-surface transition-colors"
          >
            {copy.cancel}
          </button>
        </form>
      )}

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">collections_bookmark</span>
          <p className="text-base">{copy.emptyTitle}</p>
          <p className="text-sm text-outline">{copy.emptyBody}</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            {copy.firstCollection}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {collections.map((col) => {
            const isExpanded = expanded === col.id;
            const items = expandedItems[col.id] ?? [];
            const isLoadingItems = expandedLoading === col.id;
            const createdAt = new Date(col.created_at).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
              year: "numeric", month: "long", day: "numeric",
            });

            return (
              <div
                key={col.id}
                className="bg-surface-container-lowest shadow-ghost overflow-hidden"
              >
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => handleExpand(col.id)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-16 h-16 shrink-0 bg-surface-container-low overflow-hidden rounded">
                      {col.thumbnail ? (
                        <img
                          src={col.thumbnail}
                          alt={col.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-2xl text-outline">photo_library</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface truncate">{col.name}</p>
                      <p className="text-xs text-outline mt-0.5">
                        {copy.itemCount(col.item_count)} · {createdAt}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-outline text-xl shrink-0 transition-transform" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      expand_more
                    </span>
                  </button>

                  {deleteTarget === col.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-outline">{copy.confirmDelete}</span>
                      <button
                        onClick={() => handleDelete(col.id)}
                        className="px-3 py-1 text-xs font-bold text-white bg-error rounded hover:opacity-90 transition-opacity"
                      >
                        {copy.delete}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(null)}
                        className="px-3 py-1 text-xs text-outline hover:text-on-surface transition-colors"
                      >
                        {copy.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteTarget(col.id)}
                      className="shrink-0 w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors"
                      aria-label={copy.deleteAria}
                    >
                      <span className="material-symbols-outlined text-xl text-outline">delete</span>
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-outline-variant px-4 pb-4">
                    {isLoadingItems ? (
                      <div className="flex justify-center py-8">
                        <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : items.length === 0 ? (
                      <div className="flex flex-col items-center py-10 gap-3 text-outline">
                        <span className="material-symbols-outlined text-4xl">image_not_supported</span>
                        <p className="text-sm">{copy.emptyCollection}</p>
                        <Link
                          href="/library"
                          className="text-xs text-primary hover:underline"
                        >
                          {copy.addFromLibrary}
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-4">
                        {items.map((item) => {
                          const img = item.image;
                          const isDeleted = !img || (img.status && img.status !== "approved") || (img.lifecycle_status && img.lifecycle_status !== "active");
                          const title = img?.title ?? copy.deletedImage;
                          const src = img?.storage_path_preview ?? "";
                          return (
                            <div key={item.id} className="group relative overflow-hidden rounded bg-surface-container-low aspect-square">
                              {isDeleted ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                  <span className="material-symbols-outlined text-2xl text-outline">hide_image</span>
                                  <span className="text-xs text-outline">{copy.deletedShort}</span>
                                </div>
                              ) : (
                                <>
                                  <Link href={`/library/${item.image_id}`}>
                                    {src ? (
                                      <img
                                        src={src}
                                        alt={title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl text-outline">image</span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </Link>
                                  <button
                                    onClick={() => handleRemoveItem(col.id, item.image_id)}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                    aria-label={copy.removeAria}
                                  >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
