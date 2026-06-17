-- IMAGE PARTNERS - Image publishing controls

alter table public.images
  add column if not exists is_published boolean not null default true,
  add column if not exists unpublished_at timestamptz,
  add column if not exists unpublished_by uuid references public.profiles(id) on delete set null,
  add column if not exists unpublished_reason text;

create index if not exists images_published_library_idx
  on public.images(status, lifecycle_status, is_published, created_at desc);
