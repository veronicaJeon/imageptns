'use client'

import Image from 'next/image'
import { ImageWithRelations } from '@/types/image'
import { useLang } from '@/lib/i18n/store'

interface ImageCardProps {
  image: ImageWithRelations
  supabaseUrl: string
}

export default function ImageCard({ image, supabaseUrl }: ImageCardProps) {
  const { lang } = useLang()
  const imageUrl = `${supabaseUrl}/storage/v1/object/public/images/${image.storage_path}`
  const width = image.width ?? 800
  const height = image.height ?? 600
  const uploaderName =
    image.profiles?.display_name ?? image.profiles?.username ?? (lang === 'ko' ? '알 수 없음' : 'Unknown')
  const uploaderUsername = image.profiles?.username ?? ''
  const tags = image.image_tags
    .map((t) => t.tags?.name)
    .filter((n): n is string => Boolean(n))
    .slice(0, 3)

  return (
    <div
      className="masonry-item group relative rounded-md overflow-hidden cursor-pointer"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="relative block w-full"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <Image
          src={imageUrl}
          alt={image.title || (lang === 'ko' ? '이미지' : 'Image')}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          unoptimized={false}
        />

        {/* Hover overlay */}
        <div
          className="
            absolute inset-0
            bg-gradient-to-t from-black/70 via-black/20 to-transparent
            opacity-0 group-hover:opacity-100
            transition-opacity duration-250 ease-out
            flex flex-col justify-end p-3 gap-2
          "
        >
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="
                    text-[10px] font-medium px-2 py-0.5 rounded-full
                    bg-white/20 backdrop-blur-sm text-white
                    border border-white/25
                  "
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          {image.title && (
            <p className="text-white font-display font-semibold text-sm leading-tight line-clamp-2">
              {image.title}
            </p>
          )}

          {/* Uploader */}
          {uploaderUsername && (
            <p className="text-white/75 text-xs font-body">
              {uploaderName && uploaderName !== uploaderUsername
                ? `${uploaderName} · @${uploaderUsername}`
                : `@${uploaderUsername}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
