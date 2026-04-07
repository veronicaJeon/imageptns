"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n/store";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-primary/10 text-primary",
  pending:  "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300",
  rejected: "bg-error/10 text-error",
  draft:    "bg-surface-container-high text-outline",
};

export default function UploadsPage() {
  const { t } = useLang();
  const up = t.dashboard.uploads;
  const c  = up.cols;

  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then(({ uploads }) => setUploads(uploads ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("이미지를 삭제하시겠습니까?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      setUploads((prev) => prev.filter((u) => u.id !== id));
    } finally {
      setDeleting(null);
    }
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
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">{up.title}</h1>
        <a
          href="/dashboard/uploads/new"
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-base">cloud_upload</span>
          {up.uploadBtn}
        </a>
      </div>

      {uploads.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">cloud_upload</span>
          <p>{up.empty}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {[c.image, c.status, c.views, c.sales, c.uploaded, ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {uploads.map((img: any) => {
                const uploaded = new Date(img.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });
                return (
                  <tr key={img.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-10 bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center">
                          {img.storage_path_preview ? (
                            <img src={img.storage_path_preview} alt={img.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-outline text-sm">image</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-on-surface font-medium max-w-[200px] truncate block">{img.title}</span>
                          {img.asset_id && <span className="text-xs text-outline">{img.asset_id}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[img.status] ?? ""}`}>
                        {up.statuses[img.status as keyof typeof up.statuses] ?? img.status}
                      </span>
                      {img.status === "rejected" && img.rejection_reason && (
                        <p className="text-[10px] text-error mt-1 max-w-[160px] truncate">{img.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{(img.views_count ?? 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{img.sales_count ?? 0}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{uploaded}</td>
                    <td className="px-6 py-4">
                      {["pending", "rejected", "draft"].includes(img.status) && (
                        <button
                          onClick={() => handleDelete(img.id)}
                          disabled={deleting === img.id}
                          className="text-outline hover:text-error transition-colors disabled:opacity-50"
                        >
                          {deleting === img.id
                            ? <span className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin inline-block" />
                            : <span className="material-symbols-outlined text-base">delete</span>
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
