-- IMAGE PARTNERS - Library-backed, unwatermarked site assets

alter table public.images
  add column if not exists promotional_use_allowed boolean not null default false,
  add column if not exists promotional_use_consented_at timestamptz,
  add column if not exists promotional_use_consent_version text,
  add column if not exists promotional_use_revoked_at timestamptz;

comment on column public.images.promotional_use_allowed is
  'Photographer explicitly permits Image Partners to use a resized, unwatermarked derivative for service promotion.';
comment on column public.images.promotional_use_consented_at is
  'Timestamp when the photographer explicitly granted promotional display permission.';
comment on column public.images.promotional_use_consent_version is
  'Version of the promotional display consent language accepted by the photographer.';
comment on column public.images.promotional_use_revoked_at is
  'Timestamp when the photographer most recently withdrew promotional display permission.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site-assets: public read" on storage.objects;
create policy "site-assets: public read"
  on storage.objects for select
  using (bucket_id = 'site-assets');

-- Writes intentionally have no client policy. Only service-role server code may
-- create or remove these derived files.
