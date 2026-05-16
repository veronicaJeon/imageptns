import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadForm from '@/components/upload/UploadForm'

export const metadata = {
  title: '이미지 업로드 — Image Partners',
}

export default async function UploadPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/upload')
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug, name_ko, name_en')
    .order('name_ko')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-on-surface tracking-tight">
          이미지 업로드
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          고품질 이미지를 업로드하고 Image Partners 컬렉션에 기여하세요.
        </p>
      </div>

      <UploadForm
        userId={user.id}
        categories={categories ?? []}
      />
    </div>
  )
}
