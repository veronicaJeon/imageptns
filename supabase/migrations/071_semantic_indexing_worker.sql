-- Atomic, service-role-only semantic embedding worker queue.

alter table public.image_semantic_embeddings
  add column if not exists claim_token uuid,
  add column if not exists next_attempt_at timestamptz;

create index if not exists image_semantic_embeddings_worker_idx
  on public.image_semantic_embeddings(provider, model, model_version, status, next_attempt_at, last_attempted_at);

create or replace function public.claim_semantic_embedding_jobs(
  p_provider text,
  p_model text,
  p_model_version text,
  p_batch_size integer default 1
)
returns table (
  id uuid,
  claim_token uuid,
  image_id uuid,
  provider text,
  model text,
  model_version text,
  dimension integer,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_provider is null or p_model is null or p_model_version is null then
    raise exception 'provider, model, and model version are required';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10 then
    raise exception 'batch size must be between 1 and 10';
  end if;

  return query
  with candidates as (
    select embedding_row.id
    from public.image_semantic_embeddings embedding_row
    where embedding_row.provider = p_provider
      and embedding_row.model = p_model
      and embedding_row.model_version = p_model_version
      and embedding_row.attempt_count < 5
      and (
        embedding_row.status = 'pending'
        or (
          embedding_row.status = 'failed'
          and embedding_row.next_attempt_at is not null
          and embedding_row.next_attempt_at <= now()
        )
        or (
          embedding_row.status = 'processing'
          and embedding_row.last_attempted_at < now() - interval '15 minutes'
        )
      )
    order by embedding_row.next_attempt_at nulls first, embedding_row.created_at, embedding_row.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.image_semantic_embeddings embedding_row
    set status = 'processing',
        claim_token = gen_random_uuid(),
        attempt_count = embedding_row.attempt_count + 1,
        last_attempted_at = now(),
        next_attempt_at = null,
        last_error_code = null,
        last_error_message = null,
        updated_at = now()
    from candidates
    where embedding_row.id = candidates.id
    returning embedding_row.*
  )
  select claimed.id, claimed.claim_token, claimed.image_id, claimed.provider,
         claimed.model, claimed.model_version, claimed.dimension, claimed.attempt_count
  from claimed;
end;
$$;

create or replace function public.complete_semantic_embedding_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_embedding real[],
  p_source_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;

  update public.image_semantic_embeddings embedding_row
  set embedding = p_embedding::extensions.halfvec,
      source_sha256 = p_source_sha256,
      status = 'ready',
      embedded_at = now(),
      claim_token = null,
      next_attempt_at = null,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
  where embedding_row.id = p_job_id
    and embedding_row.status = 'processing'
    and embedding_row.claim_token = p_claim_token
    and embedding_row.dimension = cardinality(p_embedding)
    and p_source_sha256 ~ '^[a-f0-9]{64}$'
    and not exists (
      select 1 from unnest(p_embedding) component(value)
      where value::text in ('NaN', 'Infinity', '-Infinity')
    )
    and exists (
      select 1 from public.images image_row
      where image_row.id = embedding_row.image_id
        and image_row.status = 'approved'
        and image_row.lifecycle_status = 'active'
        and image_row.is_published = true
        and image_row.approved_at is not null
    );
  if found then return true; end if;

  update public.image_semantic_embeddings
  set status = 'stale', claim_token = null, next_attempt_at = null,
      last_error_code = 'IMAGE_BECAME_INELIGIBLE',
      last_error_message = 'Image is no longer eligible for semantic indexing',
      updated_at = now()
  where id = p_job_id and status = 'processing' and claim_token = p_claim_token;
  return false;
end;
$$;

create or replace function public.finish_semantic_embedding_job_failure(
  p_job_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_mark_stale boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;

  update public.image_semantic_embeddings embedding_row
  set status = case when p_mark_stale then 'stale' else 'failed' end,
      claim_token = null,
      next_attempt_at = case
        when not p_mark_stale and p_retryable and embedding_row.attempt_count < 5
          then now() + make_interval(secs => least(3600, 60 * power(2, embedding_row.attempt_count)::integer))
        else null
      end,
      last_error_code = left(regexp_replace(coalesce(p_error_code, 'UNKNOWN'), '[[:cntrl:]]', ' ', 'g'), 80),
      last_error_message = left(regexp_replace(coalesce(p_error_message, 'Semantic indexing failed'), '[[:cntrl:]]', ' ', 'g'), 500),
      updated_at = now()
  where embedding_row.id = p_job_id
    and embedding_row.status = 'processing'
    and embedding_row.claim_token = p_claim_token;
  return found;
end;
$$;

revoke all on function public.claim_semantic_embedding_jobs(text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_semantic_embedding_job(uuid, uuid, real[], text)
  from public, anon, authenticated;
revoke all on function public.finish_semantic_embedding_job_failure(uuid, uuid, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_semantic_embedding_jobs(text, text, text, integer) to service_role;
grant execute on function public.complete_semantic_embedding_job(uuid, uuid, real[], text) to service_role;
grant execute on function public.finish_semantic_embedding_job_failure(uuid, uuid, text, text, boolean, boolean) to service_role;

comment on function public.claim_semantic_embedding_jobs(text, text, text, integer) is
  'Atomically claims bounded semantic indexing jobs with stale-claim recovery.';
