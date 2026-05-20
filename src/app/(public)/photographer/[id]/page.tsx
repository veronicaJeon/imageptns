"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { MasonryGrid } from "@/components/gallery/MasonryGrid";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";

interface PhotographerData {
  id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  member_since: string;
  stats: {
    total_images: number;
    total_sales: number;
    total_views: number;
  };
}

interface PhotographerImageRow {
  id: string;
  title: string;
  category: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

export default function PhotographerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLang();
  const p = t.photographerProfile;

  const [photographer, setPhotographer] = useState<PhotographerData | null>(null);
  const [images, setImages] = useState<ImageCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/photographer/${id}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setPhotographer(data.photographer);
        setImages(
          ((data.images ?? []) as PhotographerImageRow[]).map((img) => ({
            id: img.id,
            title: img.title,
            category: img.category,
            photographer: data.photographer.full_name,
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height,
          }))
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="pt-36 min-h-screen bg-surface flex items-center justify-center">
        <span className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !photographer) {
    return (
      <div className="pt-36 min-h-screen bg-surface flex flex-col items-center justify-center gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl">person_off</span>
        <p className="text-base">{p.notFound}</p>
        <Link href="/library" className="text-primary font-bold text-sm hover:underline">
          {p.backToLibrary}
        </Link>
      </div>
    );
  }

  const memberYear = new Date(photographer.member_since).getFullYear();
  const initials = photographer.full_name
    ? photographer.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <>
      {/* ── Profile Header ─────────────────────────── */}
      <section className="pt-28 pb-16 px-6 md:px-16 bg-surface border-b border-outline-variant/20">
        <div className="max-w-5xl mx-auto">
          {/* Back link */}
          <Link
            href="/library"
            className="inline-flex items-center gap-1 text-xs text-outline hover:text-primary transition-colors mb-8 uppercase tracking-widest font-bold"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Library
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            {/* Avatar */}
            <div className="shrink-0">
              {photographer.avatar_url ? (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden shadow-ghost">
                  <Image
                    src={photographer.avatar_url}
                    alt={photographer.full_name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary-container flex items-center justify-center shadow-ghost">
                  <span className="font-headline font-extrabold text-3xl md:text-4xl text-on-primary-container">
                    {initials}
                  </span>
                </div>
              )}
            </div>

            {/* Name + Bio */}
            <div className="flex-1 min-w-0">
              <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-2">
                {photographer.full_name}
              </h1>
              <p className="text-xs text-outline uppercase tracking-[0.2em] font-bold mb-4">
                {p.memberSince} {memberYear}
              </p>
              {photographer.bio && (
                <p className="text-on-surface-variant leading-relaxed max-w-xl text-sm md:text-base">
                  {photographer.bio}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex md:flex-col gap-6 md:gap-4 shrink-0 md:items-end">
              <div className="text-center md:text-right">
                <p className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">
                  {photographer.stats.total_images.toLocaleString()}
                </p>
                <p className="text-[10px] text-outline uppercase tracking-widest font-bold mt-0.5">
                  {p.images}
                </p>
              </div>
              <div className="text-center md:text-right">
                <p className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">
                  {photographer.stats.total_sales.toLocaleString()}
                </p>
                <p className="text-[10px] text-outline uppercase tracking-widest font-bold mt-0.5">
                  {p.totalSales}
                </p>
              </div>
              <div className="text-center md:text-right">
                <p className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">
                  {photographer.stats.total_views.toLocaleString()}
                </p>
                <p className="text-[10px] text-outline uppercase tracking-widest font-bold mt-0.5">
                  {p.totalViews}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Portfolio Grid ─────────────────────────── */}
      <section className="py-12 px-6 md:px-8 bg-surface-container-low min-h-[60vh]">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-headline text-sm font-bold uppercase tracking-[0.3em] text-outline mb-8">
            {p.portfolio}
          </h2>

          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4 text-outline">
              <span className="material-symbols-outlined text-6xl">image_search</span>
              <p className="text-base">{p.noImages}</p>
            </div>
          ) : (
            <MasonryGrid>
              {images.map((img) => (
                <Link key={img.id} href={`/library/${img.id}`}>
                  <ImageCard
                    image={img}
                    className="mb-4 break-inside-avoid"
                  />
                </Link>
              ))}
            </MasonryGrid>
          )}
        </div>
      </section>
    </>
  );
}
