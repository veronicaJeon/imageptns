-- ============================================================
-- IMAGE PARTNERS — Admin Schema
-- ============================================================

-- Add is_admin flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ── 어드민 지정 방법 ─────────────────────────────────────────
-- 아래 쿼리에서 이메일 주소를 수정한 뒤 실행하세요:
--
-- UPDATE public.profiles
-- SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
