-- IMAGE PARTNERS - Admin-editable about page content

create table if not exists public.about_page_content (
  slug text primary key default 'about',
  content jsonb not null,
  draft_content jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint about_page_content_singleton_check check (slug = 'about'),
  constraint about_page_content_content_object_check check (jsonb_typeof(content) = 'object'),
  constraint about_page_content_draft_object_check check (
    draft_content is null or jsonb_typeof(draft_content) = 'object'
  )
);

create index if not exists about_page_content_published_at_idx
  on public.about_page_content(published_at desc);

alter table public.about_page_content enable row level security;

drop policy if exists "about_page_content: public select published" on public.about_page_content;
create policy "about_page_content: public select published"
  on public.about_page_content for select
  using (published_at is not null);

drop policy if exists "about_page_content: admin all" on public.about_page_content;
create policy "about_page_content: admin all"
  on public.about_page_content for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
