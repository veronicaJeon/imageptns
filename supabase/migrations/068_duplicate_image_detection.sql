-- Exact duplicate blocking and conservative visual duplicate review.

create table if not exists public.image_fingerprints (
  id uuid primary key default gen_random_uuid(),
  upload_session_id uuid unique references public.upload_sessions(id) on delete cascade,
  image_id uuid unique references public.images(id) on delete set null,
  photographer_id uuid references public.profiles(id) on delete set null,
  original_sha256 text not null check (original_sha256 ~ '^[a-f0-9]{64}$'),
  phash bit(64) not null,
  dhash bit(64) not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  algorithm_version text not null default 'phash-dhash-v1',
  tombstone_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (photographer_id, original_sha256)
);

create index if not exists image_fingerprints_sha_idx on public.image_fingerprints(original_sha256);
create index if not exists image_fingerprints_created_idx on public.image_fingerprints(created_at desc);

alter table public.image_fingerprints enable row level security;
revoke all on public.image_fingerprints from anon, authenticated;

alter table public.images
  add column if not exists duplicate_review_status text not null default 'clear',
  add column if not exists duplicate_of_fingerprint_id uuid references public.image_fingerprints(id) on delete set null,
  add column if not exists duplicate_match_kind text,
  add column if not exists duplicate_phash_distance integer,
  add column if not exists duplicate_dhash_distance integer,
  add column if not exists duplicate_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists duplicate_reviewed_at timestamptz,
  add column if not exists duplicate_review_reason text;

alter table public.images
  add constraint images_duplicate_review_status_check
    check (duplicate_review_status in ('clear', 'required', 'confirmed', 'overridden')),
  add constraint images_duplicate_match_kind_check
    check (duplicate_match_kind is null or duplicate_match_kind in ('exact', 'visual')),
  add constraint images_duplicate_distance_check
    check (
      (duplicate_phash_distance is null or duplicate_phash_distance between 0 and 64)
      and (duplicate_dhash_distance is null or duplicate_dhash_distance between 0 and 64)
    ),
  add constraint images_duplicate_publication_check
    check (is_published is not true or duplicate_review_status in ('clear', 'overridden'));

create or replace function public.reserve_image_fingerprint(
  p_upload_session_id uuid,
  p_photographer_id uuid,
  p_original_sha256 text,
  p_phash text,
  p_dhash text,
  p_width integer,
  p_height integer,
  p_algorithm_version text default 'phash-dhash-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fingerprint_id uuid;
  v_match record;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_original_sha256 !~ '^[a-f0-9]{64}$'
    or p_phash !~ '^[01]{64}$'
    or p_dhash !~ '^[01]{64}$'
    or p_width <= 0 or p_height <= 0 then
    raise exception 'invalid fingerprint';
  end if;
  if not exists (
    select 1 from public.upload_sessions
    where id = p_upload_session_id and user_id = p_photographer_id and status = 'processing'
  ) then
    raise exception 'invalid upload session';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_photographer_id::text || ':' || p_original_sha256, 0));

  select f.id, f.image_id into v_match
  from public.image_fingerprints f
  where f.photographer_id = p_photographer_id
    and f.original_sha256 = p_original_sha256
    and (f.tombstone_expires_at is null or f.tombstone_expires_at > now())
  limit 1;
  if found then
    return jsonb_build_object('blocked', true, 'match_kind', 'exact');
  end if;

  insert into public.image_fingerprints (
    upload_session_id, photographer_id, original_sha256, phash, dhash,
    width, height, algorithm_version
  ) values (
    p_upload_session_id, p_photographer_id, p_original_sha256, p_phash::bit(64), p_dhash::bit(64),
    p_width, p_height, coalesce(nullif(p_algorithm_version, ''), 'phash-dhash-v1')
  ) returning id into v_fingerprint_id;

  select f.id, f.image_id, 'exact'::text as match_kind, 0 as phash_distance, 0 as dhash_distance
    into v_match
  from public.image_fingerprints f
  where f.id <> v_fingerprint_id
    and f.original_sha256 = p_original_sha256
    and f.photographer_id is distinct from p_photographer_id
    and (f.tombstone_expires_at is null or f.tombstone_expires_at > now())
  order by (f.image_id is not null) desc, f.created_at asc
  limit 1;

  if not found then
    select f.id, f.image_id, 'visual'::text as match_kind,
      bit_count(f.phash # p_phash::bit(64))::integer as phash_distance,
      bit_count(f.dhash # p_dhash::bit(64))::integer as dhash_distance
      into v_match
    from public.image_fingerprints f
    where f.id <> v_fingerprint_id
      and (f.tombstone_expires_at is null or f.tombstone_expires_at > now())
      and abs((f.width::numeric / f.height) - (p_width::numeric / p_height))
        / greatest((f.width::numeric / f.height), (p_width::numeric / p_height)) <= 0.01
      and bit_count(f.phash # p_phash::bit(64)) <= 12
      and bit_count(f.dhash # p_dhash::bit(64)) <= 4
    order by
      bit_count(f.phash # p_phash::bit(64)) + bit_count(f.dhash # p_dhash::bit(64)),
      (f.image_id is not null) desc,
      f.created_at asc
    limit 1;
  end if;

  return jsonb_build_object(
    'blocked', false,
    'fingerprint_id', v_fingerprint_id,
    'matched_fingerprint_id', v_match.id,
    'matched_image_id', v_match.image_id,
    'match_kind', v_match.match_kind,
    'phash_distance', v_match.phash_distance,
    'dhash_distance', v_match.dhash_distance
  );
end;
$$;

revoke all on function public.reserve_image_fingerprint(uuid, uuid, text, text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_image_fingerprint(uuid, uuid, text, text, text, integer, integer, text) to service_role;

create or replace function public.mark_deleted_image_fingerprint_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.image_fingerprints
  set image_id = null,
      tombstone_expires_at = greatest(coalesce(tombstone_expires_at, now()), now() + interval '1 year'),
      updated_at = now()
  where image_id = old.id;
  return old;
end;
$$;

drop trigger if exists images_fingerprint_tombstone_before_delete on public.images;
create trigger images_fingerprint_tombstone_before_delete
before delete on public.images
for each row execute function public.mark_deleted_image_fingerprint_tombstone();

create or replace function public.purge_expired_image_fingerprints()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  delete from public.image_fingerprints
  where (image_id is null and tombstone_expires_at < now())
     or (image_id is null and tombstone_expires_at is null and created_at < now() - interval '1 day');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_image_fingerprints() from public, anon, authenticated;
grant execute on function public.purge_expired_image_fingerprints() to service_role;
