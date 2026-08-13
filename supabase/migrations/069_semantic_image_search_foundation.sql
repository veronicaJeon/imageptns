-- Provider-neutral semantic image search storage. The feature remains disabled
-- until a provider, privacy policy, evaluation set, and runtime adapter are approved.

create extension if not exists vector with schema extensions;

create table public.image_semantic_embeddings (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{0,62}$'),
  model text not null check (char_length(model) between 1 and 160),
  model_version text not null check (char_length(model_version) between 1 and 160),
  dimension integer not null check (dimension between 1 and 4000),
  embedding extensions.halfvec,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed', 'stale')),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempted_at timestamptz,
  embedded_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  last_error_message text check (last_error_message is null or char_length(last_error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (image_id, provider, model, model_version),
  constraint image_semantic_embeddings_vector_dimension_check
    check (embedding is null or extensions.vector_dims(embedding) = dimension),
  constraint image_semantic_embeddings_ready_check
    check (status <> 'ready' or (embedding is not null and embedded_at is not null))
);

create index image_semantic_embeddings_lookup_idx
  on public.image_semantic_embeddings(provider, model, model_version, status, dimension);
create index image_semantic_embeddings_image_idx
  on public.image_semantic_embeddings(image_id);

comment on table public.image_semantic_embeddings is
  'Server-only multimodal image embeddings. Multiple provider/model versions coexist for evaluation and rollback.';
comment on column public.image_semantic_embeddings.last_error_message is
  'Sanitized summary only; never store provider payloads, URLs, image data, personal data, or secrets.';

alter table public.image_semantic_embeddings enable row level security;
revoke all on public.image_semantic_embeddings from public, anon, authenticated;
grant select, insert, update, delete on public.image_semantic_embeddings to service_role;

create or replace function public.match_semantic_image_embeddings(
  p_query_embedding real[],
  p_provider text,
  p_model text,
  p_model_version text,
  p_match_count integer default 20,
  p_min_similarity real default -1
)
returns table (
  image_id uuid,
  cosine_similarity real
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_dimension integer := cardinality(p_query_embedding);
  v_query extensions.halfvec;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if v_dimension is null or v_dimension < 1 or v_dimension > 4000 then
    raise exception 'invalid embedding dimension';
  end if;
  if p_provider is null or p_model is null or p_model_version is null then
    raise exception 'provider, model, and model version are required';
  end if;
  if p_match_count is null or p_match_count < 1 or p_match_count > 100 then
    raise exception 'match count must be between 1 and 100';
  end if;
  if p_min_similarity is null or p_min_similarity < -1 or p_min_similarity > 1 then
    raise exception 'minimum similarity must be between -1 and 1';
  end if;
  if exists (
    select 1 from unnest(p_query_embedding) as component(value)
    where value::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'embedding values must be finite';
  end if;

  v_query := p_query_embedding::extensions.halfvec;

  return query
  select
    embedding_row.image_id,
    (1 - (embedding_row.embedding <=> v_query))::real as cosine_similarity
  from public.image_semantic_embeddings embedding_row
  join public.images image_row on image_row.id = embedding_row.image_id
  where embedding_row.status = 'ready'
    and embedding_row.provider = p_provider
    and embedding_row.model = p_model
    and embedding_row.model_version = p_model_version
    and embedding_row.dimension = v_dimension
    and embedding_row.embedding is not null
    and image_row.status = 'approved'
    and image_row.lifecycle_status = 'active'
    and image_row.is_published = true
    and (1 - (embedding_row.embedding <=> v_query)) >= p_min_similarity
  order by embedding_row.embedding <=> v_query, embedding_row.image_id
  limit p_match_count;
end;
$$;

revoke all on function public.match_semantic_image_embeddings(real[], text, text, text, integer, real)
  from public, anon, authenticated;
grant execute on function public.match_semantic_image_embeddings(real[], text, text, text, integer, real)
  to service_role;
