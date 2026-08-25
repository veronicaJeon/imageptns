-- Private, metadata-free image derivatives for semantic embeddings, captions,
-- and as the clean source for public watermarked previews.

alter table public.images
  add column if not exists storage_path_analysis text,
  add column if not exists analysis_derivative_version text;

alter table public.images
  drop constraint if exists images_analysis_derivative_pair_check,
  add constraint images_analysis_derivative_pair_check check (
    (storage_path_analysis is null and analysis_derivative_version is null)
    or (
      storage_path_analysis is not null
      and analysis_derivative_version ~ '^analysis-v[0-9]+$'
    )
  );

comment on column public.images.storage_path_analysis is
  'Server-only metadata-free image derivative path. Never expose through public APIs.';
comment on column public.images.analysis_derivative_version is
  'Version of the private derivative pipeline used by AI indexing and captions.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images-analysis', 'images-analysis', false, 10485760, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no storage.objects policy: only the service role may read or
-- write these clean derivatives.

