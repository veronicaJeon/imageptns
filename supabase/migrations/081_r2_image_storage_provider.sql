alter table public.upload_sessions
  add column if not exists storage_provider text not null default 'supabase';

alter table public.upload_sessions
  drop constraint if exists upload_sessions_storage_provider_check;
alter table public.upload_sessions
  add constraint upload_sessions_storage_provider_check
  check (storage_provider in ('supabase', 'r2'));

alter table public.images
  add column if not exists storage_provider_original text not null default 'supabase',
  add column if not exists storage_provider_analysis text not null default 'supabase',
  add column if not exists storage_provider_preview text not null default 'supabase',
  add column if not exists storage_provider_full text not null default 'supabase';

alter table public.images
  drop constraint if exists images_storage_provider_original_check,
  drop constraint if exists images_storage_provider_analysis_check,
  drop constraint if exists images_storage_provider_preview_check,
  drop constraint if exists images_storage_provider_full_check;

alter table public.images
  add constraint images_storage_provider_original_check check (storage_provider_original in ('supabase', 'r2')),
  add constraint images_storage_provider_analysis_check check (storage_provider_analysis in ('supabase', 'r2')),
  add constraint images_storage_provider_preview_check check (storage_provider_preview in ('supabase', 'r2')),
  add constraint images_storage_provider_full_check check (storage_provider_full in ('supabase', 'r2'));

comment on column public.upload_sessions.storage_provider is
  'Storage provider selected when the one-time upload session is created.';
comment on column public.images.storage_provider_original is
  'Provider for storage_path_original. Existing rows remain on Supabase; new R2 rows are marked r2.';
comment on column public.images.storage_provider_analysis is
  'Provider for storage_path_analysis.';
comment on column public.images.storage_provider_preview is
  'Provider for storage_path_preview and its thumbs/ derivative.';
comment on column public.images.storage_provider_full is
  'Provider for storage_path_full.';
