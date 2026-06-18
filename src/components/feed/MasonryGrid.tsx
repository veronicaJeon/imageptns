'use client'

import Link from 'next/link'
import { ImageWithRelations } from '@/types/image'
import { useLang } from '@/lib/i18n/store'
import ImageCard from './ImageCard'

interface MasonryGridProps {
  images: ImageWithRelations[]
  supabaseUrl: string
}

export default function MasonryGrid({ images, supabaseUrl }: MasonryGridProps) {
  const { lang } = useLang()
  const copy = lang === 'ko'
    ? {
        emptyTitle: '아직 업로드된 이미지가 없어요',
        emptyBody: '첫 번째 이미지를 업로드하고 컬렉션을 시작해보세요.',
        upload: '지금 업로드하기',
      }
    : {
        emptyTitle: 'No images have been uploaded yet',
        emptyBody: 'Upload the first image and start the collection.',
        upload: 'Upload now',
      }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
        <div className="flex flex-col gap-2">
          <p
            className="text-2xl font-display font-semibold"
            style={{ color: 'var(--color-on-surface)' }}
          >
            {copy.emptyTitle}
          </p>
          <p
            className="text-sm font-body"
            style={{ color: 'var(--color-on-surface-variant)' }}
          >
            {copy.emptyBody}
          </p>
        </div>
        <Link
          href="/dashboard/uploads/new"
          className="
            gradient-cta text-white font-body font-medium
            px-6 py-2.5 rounded-full text-sm
            transition-opacity hover:opacity-90
          "
        >
          {copy.upload}
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
