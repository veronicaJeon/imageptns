"use client";

import Link from "next/link";

export default function CollectionsPage() {
  return (
    <div className="p-6 md:p-10">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-8 tracking-tight">
        Collections
      </h1>
      <div className="flex flex-col items-center py-32 gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl">collections_bookmark</span>
        <p className="text-base">Collections feature coming soon.</p>
        <p className="text-sm text-on-surface-variant">즐겨찾기에 저장된 이미지를 컬렉션으로 정리하는 기능이 곧 추가됩니다.</p>
        <Link href="/dashboard/favorites" className="mt-4 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
          즐겨찾기 보기
        </Link>
      </div>
    </div>
  );
}
