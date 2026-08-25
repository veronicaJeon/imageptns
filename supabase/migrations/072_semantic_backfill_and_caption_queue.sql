-- Production-safe semantic backfill and optional async NVIDIA captions.
-- Both queues are service-role only and accept approved, active, published
-- preview derivatives only. Provider flags remain the runtime activation gate.

create or replace function public.enqueue_semantic_embedding_backfill(
  p_provider text,
  p_model text,
  p_model_version text,
  p_dimension integer,
  p_batch_size integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_provider is null or p_model is null or p_model_version is null then
    raise exception 'provider, model, and model version are required';
  end if;
  if p_dimension is null or p_dimension < 1 or p_dimension > 4000 then
    raise exception 'dimension must be between 1 and 4000';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10 then
    raise exception 'batch size must be between 1 and 10';
  end if;

  insert into public.image_semantic_embeddings (
    image_id, provider, model, model_version, dimension, status
  )
  select image_row.id, p_provider, p_model, p_model_version, p_dimension, 'pending'
  from public.images image_row
  where image_row.status = 'approved'
    and image_row.lifecycle_status = 'active'
    and image_row.is_published = true
    and image_row.approved_at is not null
    and image_row.storage_path_preview is not null
    and not exists (
      select 1
      from public.image_semantic_embeddings embedding_row
      where embedding_row.image_id = image_row.id
        and embedding_row.provider = p_provider
        and embedding_row.model = p_model
        and embedding_row.model_version = p_model_version
    )
  order by image_row.approved_at, image_row.id
  limit p_batch_size
  on conflict (image_id, provider, model, model_version) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.enqueue_semantic_embedding_backfill(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_semantic_embedding_backfill(text, text, text, integer, integer)
  to service_role;

create table public.image_ai_captions (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9][a-z0-9_-]{0,62}$'),
  model text not null check (char_length(model) between 1 and 160),
  model_version text not null check (char_length(model_version) between 1 and 160),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed', 'stale')),
  caption_en text check (caption_en is null or char_length(caption_en) <= 1000),
  keywords_en text[] not null default '{}',
  claim_token uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempted_at timestamptz,
  next_attempt_at timestamptz,
  generated_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  last_error_message text check (last_error_message is null or char_length(last_error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (image_id, provider, model, model_version),
  constraint image_ai_captions_ready_check
    check (status <> 'ready' or (caption_en is not null and generated_at is not null))
);

create index image_ai_captions_worker_idx
  on public.image_ai_captions(provider, model, model_version, status, next_attempt_at, last_attempted_at);
alter table public.image_ai_captions enable row level security;
revoke all on public.image_ai_captions from public, anon, authenticated;
grant select, insert, update, delete on public.image_ai_captions to service_role;

comment on table public.image_ai_captions is
  'Server-only supplemental AI captions. Photographer-authored descriptions remain authoritative and are never overwritten.';

create or replace function public.enqueue_ai_caption_backfill(
  p_provider text,
  p_model text,
  p_model_version text,
  p_batch_size integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_provider is null or p_model is null or p_model_version is null then
    raise exception 'provider, model, and model version are required';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 3 then
    raise exception 'batch size must be between 1 and 3';
  end if;

  insert into public.image_ai_captions (image_id, provider, model, model_version)
  select image_row.id, p_provider, p_model, p_model_version
  from public.images image_row
  where image_row.status = 'approved'
    and image_row.lifecycle_status = 'active'
    and image_row.is_published = true
    and image_row.approved_at is not null
    and image_row.storage_path_preview is not null
  order by image_row.approved_at, image_row.id
  limit p_batch_size
  on conflict (image_id, provider, model, model_version) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.enqueue_ai_caption_backfill(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_ai_caption_backfill(text, text, text, integer)
  to service_role;

create or replace function public.claim_ai_caption_jobs(
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
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 3 then
    raise exception 'batch size must be between 1 and 3';
  end if;

  return query
  with candidates as (
    select caption_row.id
    from public.image_ai_captions caption_row
    where caption_row.provider = p_provider
      and caption_row.model = p_model
      and caption_row.model_version = p_model_version
      and caption_row.attempt_count < 3
      and (
        caption_row.status = 'pending'
        or (caption_row.status = 'failed' and caption_row.next_attempt_at <= now())
        or (caption_row.status = 'processing' and caption_row.last_attempted_at < now() - interval '15 minutes')
      )
    order by caption_row.next_attempt_at nulls first, caption_row.created_at, caption_row.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.image_ai_captions caption_row
    set status = 'processing', claim_token = gen_random_uuid(),
        attempt_count = caption_row.attempt_count + 1,
        last_attempted_at = now(), next_attempt_at = null,
        last_error_code = null, last_error_message = null, updated_at = now()
    from candidates
    where caption_row.id = candidates.id
    returning caption_row.*
  )
  select claimed.id, claimed.claim_token, claimed.image_id, claimed.provider,
         claimed.model, claimed.model_version, claimed.attempt_count
  from claimed;
end;
$$;

create or replace function public.complete_ai_caption_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_caption_en text,
  p_keywords_en text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_caption_en is null or char_length(trim(p_caption_en)) < 1 or char_length(p_caption_en) > 1000 then
    raise exception 'invalid caption';
  end if;

  update public.image_ai_captions caption_row
  set status = 'ready', caption_en = trim(p_caption_en),
      keywords_en = coalesce(p_keywords_en[1:20], '{}'), generated_at = now(),
      claim_token = null, next_attempt_at = null,
      last_error_code = null, last_error_message = null, updated_at = now()
  where caption_row.id = p_job_id
    and caption_row.status = 'processing'
    and caption_row.claim_token = p_claim_token
    and exists (
      select 1 from public.images image_row
      where image_row.id = caption_row.image_id
        and image_row.status = 'approved'
        and image_row.lifecycle_status = 'active'
        and image_row.is_published = true
        and image_row.approved_at is not null
    );
  return found;
end;
$$;

create or replace function public.finish_ai_caption_job_failure(
  p_job_id uuid,
  p_claim_token uuid,
  p_error_code text,
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

  update public.image_ai_captions caption_row
  set status = case when p_mark_stale then 'stale' else 'failed' end,
      claim_token = null,
      next_attempt_at = case
        when not p_mark_stale and p_retryable and caption_row.attempt_count < 3
          then now() + make_interval(secs => least(3600, 120 * power(2, caption_row.attempt_count)::integer))
        else null
      end,
      last_error_code = left(regexp_replace(coalesce(p_error_code, 'UNKNOWN'), '[[:cntrl:]]', ' ', 'g'), 80),
      last_error_message = 'Caption provider request failed',
      updated_at = now()
  where caption_row.id = p_job_id
    and caption_row.status = 'processing'
    and caption_row.claim_token = p_claim_token;
  return found;
end;
$$;

revoke all on function public.claim_ai_caption_jobs(text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_ai_caption_job(uuid, uuid, text, text[])
  from public, anon, authenticated;
revoke all on function public.finish_ai_caption_job_failure(uuid, uuid, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_ai_caption_jobs(text, text, text, integer) to service_role;
grant execute on function public.complete_ai_caption_job(uuid, uuid, text, text[]) to service_role;
grant execute on function public.finish_ai_caption_job_failure(uuid, uuid, text, boolean, boolean) to service_role;

-- Supplemental captions are a B-weight search signal. They never replace the
-- photographer-authored title, description, or tags.
create or replace function public.update_image_fts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ai_caption text;
begin
  select string_agg(
    coalesce(caption_row.caption_en, '') || ' ' || coalesce(array_to_string(caption_row.keywords_en, ' '), ''),
    ' '
  )
  into v_ai_caption
  from public.image_ai_captions caption_row
  where caption_row.image_id = new.id and caption_row.status = 'ready';

  new.fts :=
    setweight(to_tsvector('simple',
      coalesce(new.title, '') || ' ' || coalesce(new.title_ko, '') || ' ' || coalesce(new.title_en, '') || ' ' ||
      coalesce(array_to_string(new.tags, ' '), '') || ' ' || coalesce(array_to_string(new.tags_ko, ' '), '') || ' ' ||
      coalesce(array_to_string(new.tags_en, ' '), '')
    ), 'A') ||
    setweight(to_tsvector('simple',
      coalesce(new.description, '') || ' ' || coalesce(new.description_ko, '') || ' ' ||
      coalesce(new.description_en, '') || ' ' || coalesce(v_ai_caption, '')
    ), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.category, '')), 'C');
  return new;
end;
$$;

create or replace function public.refresh_image_fts_from_ai_caption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ready' and (
    old.status is distinct from new.status
    or old.caption_en is distinct from new.caption_en
    or old.keywords_en is distinct from new.keywords_en
  ) then
    update public.images set title = title where id = new.image_id;
  end if;
  return new;
end;
$$;

create trigger refresh_image_fts_after_ai_caption
after update of status, caption_en, keywords_en on public.image_ai_captions
for each row execute function public.refresh_image_fts_from_ai_caption();

revoke all on function public.refresh_image_fts_from_ai_caption()
  from public, anon, authenticated;
