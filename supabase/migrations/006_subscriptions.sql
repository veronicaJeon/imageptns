-- ============================================================
-- IMAGE PARTNERS — Subscriptions (Toss Payments 정기결제)
-- ============================================================

CREATE TABLE public.subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan                  varchar(20) NOT NULL CHECK (plan IN ('basic', 'pro', 'enterprise')),
  billing_key           text,                        -- Toss 빌링키
  customer_key          text,                        -- Toss 고객키 (UUID per user)
  status                varchar(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_start  timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  toss_order_id         text,                        -- 최초 결제 주문 ID
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 서버 측(service_role) 에서 insert/update 를 담당하므로
-- anon/authenticated 에 대한 write 정책은 의도적으로 추가하지 않음.
