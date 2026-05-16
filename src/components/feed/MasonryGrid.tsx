'use client'

import Link from 'next/link'
import { ImageWithRelations } from '@/types/image'
import ImageCard from './ImageCard'

interface MasonryGridProps {
  images: ImageWithRelations[]
  supabaseUrl: string
}

export default function MasonryGrid({ images, supabaseUrl }: MasonryGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
        <div className="flex flex-col gap-2">
          <p
            className="text-2xl font-display font-semibold"
            style={{ color: 'var(--color-on-surface)' }}
          >
            아직 업로드된 이미지가 없어요
          </p>
          <p
            className="text-sm font-body"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            첫 번째 이미지를 업로드하고 컬렉션을 시작해보세요.
          </p>
        </div>
        <Link
          href="/upload"
          className="
            gradient-cta text-white font-body font-medium
            px-6 py-2.5 rounded-full text-sm
            transition-opacity hover:opacity-90
          "
        >
          지금 업로드하기
        </Link>
      </div>
    )
  }

  return (
    <div className="masonry-grid">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} supabaseUrl={supabaseUrl} />
      ))}
    </div>
  )
}
