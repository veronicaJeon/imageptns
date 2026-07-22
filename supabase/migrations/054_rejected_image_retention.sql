-- Admin-managed retention for rejected photographer uploads.

alter table public.platform_commerce_settings
  add column if not exists rejected_image_retention_days integer not null default 7;

alter table public.platform_commerce_settings
  drop constraint if exists platform_commerce_settings_rejected_retention_check;

alter table public.platform_commerce_settings
  add constraint platform_commerce_settings_rejected_retention_check
  check (rejected_image_retention_days between 1 and 365);

alter table public.images
  add column if not exists rejected_at timestamptz;

update public.images
set rejected_at = coalesce(updated_at, created_at)
where status = 'rejected'
  and rejected_at is null;

create index if not exists images_rejected_retention_idx
  on public.images(rejected_at)
  where status = 'rejected' and lifecycle_status = 'active';

create or replace function public.archive_expired_rejected_images()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  retention_days integer;
  archived_count integer;
begin
  select rejected_image_retention_days
  into retention_days
  from public.platform_commerce_settings
  where id = true;

  retention_days := coalesce(retention_days, 7);

  update public.images
  set lifecycle_status = 'archived',
      is_published = false,
      archived_at = coalesce(archived_at, now()),
      unpublished_at = coalesce(unpublished_at, now()),
      unpublished_reason = coalesce(unpublished_reason, 'Rejected image retention expired'),
      updated_at = now()
  where status = 'rejected'
    and lifecycle_status = 'active'
    and coalesce(rejected_at, updated_at, created_at) < now() - make_interval(days => retention_days);

  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_expired_rejected_images() from public, anon, authenticated;
grant execute on function public.archive_expired_rejected_images() to service_role;

create or replace function public.archive_unregistered_photographer_image(
  target_image_id uuid,
  target_user_id uuid,
  deletion_reason_text text,
  reason_category_text text default 'other'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  image_row public.images%rowtype;
  request_id uuid;
  archived_time timestamptz := now();
  notice_text text := '사진가 요청으로 웹사이트 공개와 신규 판매가 중단되었습니다. 실제 데이터 완전삭제는 관리자가 별도로 검토합니다.';
begin
  select * into image_row
  from public.images
  where id = target_image_id
    and photographer_id = target_user_id
  for update;

  if not found then
    raise exception 'Image not found';
  end if;

  if image_row.lifecycle_status <> 'active' then
    raise exception 'Image deletion is already in progress or complete';
  end if;

  if image_row.proof_arweave_confirmed_at is not null
    or nullif(trim(image_row.proof_arweave_original_tx_id), '') is not null
    or nullif(trim(image_row.proof_arweave_metadata_tx_id), '') is not null
    or nullif(trim(image_row.proof_arweave_manifest_tx_id), '') is not null then
    raise exception 'Arweave credential requires administrator review';
  end if;

  update public.order_items
  set image_title_snapshot = coalesce(image_title_snapshot, image_row.title),
      image_asset_id_snapshot = coalesce(image_asset_id_snapshot, image_row.asset_id),
      image_preview_path_snapshot = coalesce(image_preview_path_snapshot, image_row.storage_path_preview),
      image_original_path_snapshot = coalesce(image_original_path_snapshot, image_row.storage_path_original, image_row.storage_path_full),
      image_original_filename_snapshot = coalesce(image_original_filename_snapshot, image_row.original_filename),
      image_lifecycle_status = 'archived',
      image_deleted_at = archived_time,
      image_deletion_notice = notice_text
  where image_id = target_image_id;

  update public.images
  set lifecycle_status = 'archived',
      is_published = false,
      archived_at = archived_time,
      deleted_at = archived_time,
      deleted_by = target_user_id,
      deletion_reason = deletion_reason_text,
      deletion_requested_at = archived_time,
      deletion_requested_by = target_user_id,
      deletion_reviewed_at = archived_time,
      deletion_reviewed_by = target_user_id,
      deletion_fee_krw = 0,
      deletion_fee_status = 'waived',
      unpublished_at = coalesce(unpublished_at, archived_time),
      unpublished_reason = coalesce(unpublished_reason, 'Photographer deletion'),
      updated_at = archived_time
  where id = target_image_id;

  insert into public.image_deletion_requests (
    image_id, requester_id, requester_role, reason_category, reason,
    requested_action, status, estimated_fee_krw, charged_fee_krw,
    fee_status, impact_snapshot, decided_by, decided_at, completed_at, updated_at
  ) values (
    target_image_id, target_user_id, 'photographer', reason_category_text, deletion_reason_text,
    'archive', 'completed', 0, 0,
    'waived', jsonb_build_object(
      'action', 'archive',
      'lifecycleStatus', 'archived',
      'buyerNoticeRequired', coalesce(image_row.sales_count, 0) > 0,
      'onchainNoticeRequired', false,
      'storagePurgeAllowed', false,
      'reasons', jsonb_build_array('photographer_immediate_archive'),
      'estimatedFeeKrw', 0
    ),
    target_user_id, archived_time, archived_time, archived_time
  ) returning id into request_id;

  return jsonb_build_object(
    'requestId', request_id,
    'imageId', target_image_id,
    'immediate', true,
    'lifecycleStatus', 'archived',
    'notice', notice_text
  );
end;
$$;

revoke all on function public.archive_unregistered_photographer_image(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.archive_unregistered_photographer_image(uuid, uuid, text, text) to service_role;
