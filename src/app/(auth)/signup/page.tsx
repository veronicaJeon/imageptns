'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const signupSchema = z.object({
  username: z
    .string()
    .min(2, '사용자명은 최소 2자 이상이어야 합니다')
    .max(30, '사용자명은 최대 30자까지 가능합니다')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      '사용자명은 영문, 숫자, 언더스코어(_)만 사용 가능합니다'
    ),
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('올바른 이메일 형식이 아닙니다'),
  password: z
    .string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
})

type SignupFormData = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  async function onSubmit(data: SignupFormData) {
    setIsLoading(true)
    setServerError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          username: data.username,
        },
      },
    })

    if (error) {
      setServerError(
        error.message === 'User already registered'
          ? '이미 등록된 이메일 주소입니다'
          : error.message
      )
      setIsLoading(false)
      return
    }

    // Redirect to home with a success indicator
    router.push('/?signup=success')
    router.refresh()
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-display font-bold text-on-surface tracking-tight">
          회원가입
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Image Partners 계정을 만들어보세요
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <div
            role="alert"
            className="rounded-lg bg-error-container px-4 py-3 text-sm text-error"
          >
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-on-surface"
          >
            사용자명
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="my_username"
            {...register('username')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {errors.username && (
            <p className="text-xs text-error">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-on-surface"
          >
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="hello@example.com"
            {...register('email')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {errors.email && (
            <p className="text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-on-surface"
          >
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('password')}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {errors.password && (
            <p className="text-xs text-error">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        이미 계정이 있으신가요?{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          로그인
        </Link>
      </p>
    </>
  )
}
