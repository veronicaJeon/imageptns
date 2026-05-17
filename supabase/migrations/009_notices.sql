CREATE TABLE IF NOT EXISTS public.notices (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  is_popup     boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices: public select published"
  ON public.notices FOR SELECT
  USING (is_published = true);

CREATE POLICY "notices: admin all"
  ON public.notices FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
