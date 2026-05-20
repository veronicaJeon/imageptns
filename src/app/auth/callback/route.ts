import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCanonicalRedirectOrigin,
  getSafeRelativePath,
} from '@/lib/routing/canonical'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeRelativePath(searchParams.get('next'), '/')
  const redirectOrigin = getCanonicalRedirectOrigin(origin)

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createAdminClient()
        await admin.rpc('record_profile_login', { target_user_id: user.id })
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`)
    }
  }

  // Something went wrong — redirect to login with an error indicator
  return NextResponse.redirect(`${redirectOrigin}/login?error=auth_callback_failed`)
}
