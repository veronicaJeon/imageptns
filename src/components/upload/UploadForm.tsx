'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────

type Category = {
  id: number
  slug: string
  name_ko: string
  name_en: string
}

type Props = {
  userId: string
  categories: Category[]
}

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200),
  caption: z.string().max(1000).optional(),
  category_id: z.string().refine(val => Number.isInteger(parseInt(val, 10)) && parseInt(val, 10) > 0, '카테고리를 선택해주세요'),
  tags: z.string().optional(),
})

type FormData = z.infer<typeof schema>

// ── Helpers ────────────────────────────────────────────────────────────────

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러올 수 없습니다'))
    }
    img.src = url
  })
}

function fileExtension(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ── Component ──────────────────────────────────────────────────────────────

export default function UploadForm({ userId, categories }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const [successImageUrl, setSuccessImageUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // ── File selection ───────────────────────────────────────────────────────

  const handleFile = useCallback((selected: File) => {
    setFileError(null)

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFileError('지원하지 않는 파일 형식입니다. JPEG, PNG, WEBP, GIF, TIFF만 허용됩니다.')
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError('파일 크기가 50MB를 초과합니다.')
      return
    }

    setFile(selected)
    const objectUrl = URL.createObjectURL(selected)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return objectUrl
    })
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFile(selected)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  const onDragLeave = () => setIsDraggingOver(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFile(dropped)
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(data: FormData) {
    if (!file) {
      setFileError('이미지를 선택해주세요.')
      return
    }

    setIsUploading(true)
    setServerError(null)
    setUploadProgress(0)

    try {
      const supabase = createClient()

      // Step 1: create image row to get a stable id (10%)
      setUploadProgress(10)
      const { width, height } = await getImageDimensions(file)
      const ext = fileExtension(file)

      const { data: imageRow, error: insertError } = await supabase
        .from('images')
        .insert({
          uploader_id: userId,
          storage_path: '',          // filled in after upload
          title: data.title,
          caption: data.caption ?? null,
          width,
          height,
          file_size: file.size,
          mime_type: file.type,
          is_published: false,
        })
        .select('id')
        .single()

      if (insertError || !imageRow) {
        throw new Error(insertError?.message ?? '이미지 정보를 저장하는 데 실패했습니다.')
      }

      const imageId: string = imageRow.id
      const storagePath = `${userId}/${imageId}.${ext}`

      // Step 2: upload file to storage (60%)
      setUploadProgress(30)
      const { error: storageError } = await supabase.storage
        .from('images')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (storageError) {
        // Clean up the orphaned row
        await supabase.from('images').delete().eq('id', imageId)
        throw new Error(storageError.message)
      }

      setUploadProgress(60)

      // Step 3: get public URL and update row with storage_path
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(storagePath)

      const { error: updateError } = await supabase
        .from('images')
        .update({
          storage_path: storagePath,
          is_published: true,
        })
        .eq('id', imageId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setUploadProgress(75)

      // Step 4: category
      const { error: catError } = await supabase
        .from('image_categories')
        .insert({ image_id: imageId, category_id: parseInt(data.category_id, 10) })

      if (catError) {
        throw new Error(catError.message)
      }

      setUploadProgress(85)

      // Step 5: tags (optional)
      const tagNames = (data.tags ?? '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      if (tagNames.length > 0) {
        // Upsert tags by name, get back their ids
        const { data: tagRows, error: tagUpsertError } = await supabase
          .from('tags')
          .upsert(
            tagNames.map((name) => ({ name })),
            { onConflict: 'name', ignoreDuplicates: false }
          )
          .select('id, name')

        if (tagUpsertError) {
          throw new Error(tagUpsertError.message)
        }

        if (tagRows && tagRows.length > 0) {
          const { error: imagTagError } = await supabase
            .from('image_tags')
            .insert(tagRows.map((tag) => ({ image_id: imageId, tag_id: tag.id })))

          if (imagTagError) {
            throw new Error(imagTagError.message)
          }
        }
      }

      setUploadProgress(100)
      setSuccessImageUrl(urlData.publicUrl)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Success state ────────────────────────────────────────────────────────

  if (successImageUrl) {
    return (
      <div className="glass rounded-xl border border-outline-variant shadow-card p-8 text-center space-y-6">
        <div className="relative mx-auto w-full max-w-sm aspect-video rounded-lg overflow-hidden shadow-card">
          <Image
            src={successImageUrl}
            alt="업로드된 이미지"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-on-surface">
            업로드 완료!
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            이미지가 성공적으로 업로드되었습니다.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setSuccessImageUrl(null)
              setFile(null)
              setPreviewUrl(null)
              setUploadProgress(0)
              router.refresh()
            }}
            className="rounded-lg border border-outline-variant bg-surface-container px-6 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            다른 이미지 업로드
          </button>
          <Link
            href="/"
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 text-center"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-6"
    >
      {/* Server error */}
      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-error-container px-4 py-3 text-sm text-error"
        >
          {serverError}
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="이미지 파일 선택 또는 드롭"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'relative flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
          isDraggingOver
            ? 'border-primary bg-primary/5'
            : 'border-outline-variant bg-surface-container-low hover:border-primary/60 hover:bg-primary/5',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          onChange={onInputChange}
        />

        {previewUrl ? (
          <div className="relative h-56 w-full overflow-hidden rounded-xl">
            <Image
              src={previewUrl}
              alt="미리보기"
              fill
              className="object-contain"
              unoptimized
            />
            <div className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-t from-black/40 to-transparent">
              <span className="text-xs font-medium text-white">
                클릭하여 파일 변경
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-12 w-12 text-outline"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-on-surface">
                이미지를 드래그하거나 클릭하여 선택하세요
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                JPEG, PNG, WEBP, GIF, TIFF — 최대 50MB
              </p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <p className="text-xs text-on-surface-variant -mt-3">
          선택된 파일: <span className="font-medium text-on-surface">{file.name}</span>{' '}
          ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}

      {fileError && (
        <p role="alert" className="text-xs text-error -mt-3">
          {fileError}
        </p>
      )}

      {/* Fields */}
      <div className="glass rounded-xl border border-outline-variant shadow-card p-6 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="title"
            className="block text-sm font-medium text-on-surface"
          >
            제목 <span className="text-error">*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="이미지의 제목을 입력해주세요"
            {...register('title')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {errors.title && (
            <p className="text-xs text-error">{errors.title.message}</p>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <label
            htmlFor="caption"
            className="block text-sm font-medium text-on-surface"
          >
            캡션
          </label>
          <textarea
            id="caption"
            rows={3}
            placeholder="이미지에 대한 설명을 입력해주세요 (선택사항)"
            {...register('caption')}
            className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {errors.caption && (
            <p className="text-xs text-error">{errors.caption.message}</p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label
            htmlFor="category_id"
            className="block text-sm font-medium text-on-surface"
          >
            카테고리 <span className="text-error">*</span>
          </label>
          <select
            id="category_id"
            {...register('category_id')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors appearance-none"
          >
            <option value="">카테고리를 선택해주세요</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name_ko}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="text-xs text-error">{errors.category_id.message}</p>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label
            htmlFor="tags"
            className="block text-sm font-medium text-on-surface"
          >
            태그
          </label>
          <input
            id="tags"
            type="text"
            placeholder="자연, 도시, 사람 (쉼표로 구분)"
            {...register('tags')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          <p className="text-xs text-on-surface-variant">
            여러 태그는 쉼표(,)로 구분해주세요.
          </p>
          {errors.tags && (
            <p className="text-xs text-error">{errors.tags.message}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>업로드 중...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isUploading}
        className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? '업로드 중...' : '업로드하기'}
      </button>
    </form>
  )
}
