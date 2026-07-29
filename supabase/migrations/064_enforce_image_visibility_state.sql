-- Keep workflow status, deletion lifecycle, and public visibility consistent.
-- New uploads are private until an administrator approves them.

alter table public.images
  alter column is_published set default false;

update public.images
set is_published = false,
    unpublished_at = coalesce(unpublished_at, now()),
    unpublished_reason = coalesce(
      unpublished_reason,
      case
        when status <> 'approved' then 'Not approved for public library'
        when lifecycle_status <> 'active' then 'Image lifecycle is not active'
        else 'Not publicly available'
      end
    ),
    updated_at = now()
where is_published = true
  and (
    status <> 'approved'
    or lifecycle_status <> 'active'
  );

alter table public.images
  drop constraint if exists images_public_visibility_state_check;

alter table public.images
  add constraint images_public_visibility_state_check
  check (
    is_published = false
    or (
      status = 'approved'
      and lifecycle_status = 'active'
    )
  );

comment on column public.images.is_published is
  'Public-library switch. May be true only when review status is approved and lifecycle status is active.';
