-- ============================================================
-- IMAGE PARTNERS — Payouts: note 컬럼 + rejected 상태 추가
-- ============================================================

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS payouts_status_check;

ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('pending','processing','paid','failed','rejected'));
