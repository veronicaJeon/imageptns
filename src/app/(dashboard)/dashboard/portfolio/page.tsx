"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/store/auth";

export default function PortfolioPage() {
  const { user, init } = useAuth();
  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then(({ uploads }) =>
        setUploads((uploads ?? []).filter((u: any) => u.status === "approved"))
      )
      .finally(() => setLoading(false));
  }, []);

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
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
            My Portfolio
          </h1>
          {user?.full_name && (
            <p className="text-sm text-outline mt-1">{user.full_name}</p>
          )}
        </div>
        <Link
          href="/dashboard/uploads"
          className="flex items-center gap-2 px-5 py-3 border border-outline-variant text-on-surface text-xs font-bold uppercase tracking-widest rounded hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-base">manage_accounts</span>
          Manage Uploads
        </Link>
      </div>

      {uploads.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">photo_library</span>
          <p>승인된 이미지가 없습니다.</p>
          <Link href="/dashboard/uploads" className="mt-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
            이미지 업로드
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uploads.map((img: any) => (
            <div key={img.id} className="group relative overflow-hidden bg-surface-container-low rounded shadow-ghost">
              <div className="aspect-[4/3] overflow-hidden">
                {img.storage_path_preview ? (
                  <img
                    src={img.storage_path_preview}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-4xl">image</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-on-surface truncate">{img.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-outline capitalize">{img.category}</span>
                  <span className="text-[10px] text-outline">{img.sales_count ?? 0} sales</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
