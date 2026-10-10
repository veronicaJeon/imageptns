-- Admin-editable login and signup presentation content.
create table if not exists public.auth_page_content (
  slug text primary key default 'auth',
  content jsonb not null,
  draft_content jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_page_content_singleton_check check (slug = 'auth'),
  constraint auth_page_content_content_object_check check (jsonb_typeof(content) = 'object'),
  constraint auth_page_content_draft_object_check check (draft_content is null or jsonb_typeof(draft_content) = 'object')
);

alter table public.auth_page_content enable row level security;
revoke all on table public.auth_page_content from public, anon, authenticated;
grant all on table public.auth_page_content to service_role;
