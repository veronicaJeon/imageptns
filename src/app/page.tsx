import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ImageWithRelations } from '@/types/image'
import MasonryGrid from '@/components/feed/MasonryGrid'

export const revalidate = 60 // ISR: refresh feed every 60 s

export default async function HomePage() {
  const supabase = await createClient()

  const { data: rawImages, error } = await supabase
    .from('images')
    .select(`
      *,
      profiles(username, display_name, avatar_url),
      image_tags(tags(name)),
      image_categories(categories(name_ko, slug))
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(60)

  if (error) {
    console.error('[Feed] Supabase query error:', error.message)
  }

  const images = (rawImages ?? []) as unknown as ImageWithRelations[]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* ── Navigation ── */}
      <header
        className="sticky top-0 z-50 glass border-b"
        style={{ borderColor: 'var(--color-outline-variant)' }}
      >
        <nav className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="font-display font-bold text-xl tracking-tight shrink-0"
            style={{ color: 'var(--color-primary)' }}
          >
            Image Partners
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search */}
            <form action="/search" method="get" className="hidden sm:flex items-center">
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--color-outline)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="search"
                  name="q"
                  placeholder="이미지 검색..."
                  className="
                    pl-9 pr-4 py-2 text-sm rounded-full font-body
                    border outline-none w-48 lg:w-60
                    transition-all focus:w-64 lg:focus:w-80
                  "
                  style={{
                    backgroundColor: 'var(--color-surface-container-low)',
                    borderColor: 'var(--color-outline-variant)',
                    color: 'var(--color-on-surface)',
                  }}
                />
              </div>
            </form>

            {/* Upload button */}
            <Link
              href="/upload"
              className="
                gradient-cta text-white font-body font-medium
                px-4 py-2 rounded-full text-sm
                transition-opacity hover:opacity-90 shrink-0
              "
            >
              업로드
            </Link>

            {/* Login button */}
            <Link
              href="/login"
              className="
                font-body font-medium text-sm px-4 py-2 rounded-full
                border transition-colors shrink-0
                hover:bg-surface-container
              "
              style={{
                color: 'var(--color-on-surface)',
                borderColor: 'var(--color-outline-variant)',
              }}
            >
              로그인
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="py-10 sm:py-14 px-4 text-center">
        <p
          className="font-display font-light text-3xl sm:text-4xl tracking-tight"
          style={{ color: 'var(--color-on-surface)' }}
        >
          큐레이션된 프리미엄 이미지
        </p>
        <p
          className="mt-3 font-body text-sm sm:text-base max-w-sm mx-auto leading-relaxed"
          style={{ color: 'var(--color-on-surface-variant)' }}
        >
          전 세계 크리에이터들의 감각적인 스톡 이미지를 자유롭게 활용하세요.
        </p>
      </section>

      {/* ── Feed ── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16">
        <MasonryGrid images={images} supabaseUrl={supabaseUrl} />
      </main>

      {/* ── Footer ── */}
      <footer
        className="py-8 border-t text-center"
        style={{
          borderColor: 'var(--color-outline-variant)',
          color: 'var(--color-on-surface-variant)',
        }}
      >
        <p className="font-body text-xs">
          © {new Date().getFullYear()} Image Partners · 모든 이미지의 저작권은 원작자에게 있습니다.
        </p>
      </footer>
    </div>
  )
}
