-- IMAGE PARTNERS - Photographer approval workflow

alter table public.profiles
  add column if not exists photographer_status text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_photographer_status_check;

alter table public.profiles
  add constraint profiles_photographer_status_check
  check (photographer_status in ('none', 'pending', 'approved', 'suspended'));

create table if not exists public.photographer_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  applicant_name text not null,
  organization text,
  phone_number text,
  primary_activity_regions text[] not null default '{}'::text[],
  bio text,
  admin_note text,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.photographer_applications
  drop constraint if exists photographer_applications_status_check,
  drop constraint if exists photographer_applications_name_length_check,
  drop constraint if exists photographer_applications_org_length_check,
  drop constraint if exists photographer_applications_phone_length_check,
  drop constraint if exists photographer_applications_regions_count_check,
  drop constraint if exists photographer_applications_bio_length_check,
  drop constraint if exists photographer_applications_rejection_reason_required_check,
  drop constraint if exists photographer_applications_review_state_consistency_check;

alter table public.photographer_applications
  add constraint photographer_applications_status_check
    check (status in ('pending', 'approved', 'rejected')),
  add constraint photographer_applications_name_length_check
    check (char_length(trim(applicant_name)) between 1 and 80),
  add constraint photographer_applications_org_length_check
    check (organization is null or char_length(organization) <= 120),
  add constraint photographer_applications_phone_length_check
    check (phone_number is null or char_length(phone_number) <= 32),
  add constraint photographer_applications_regions_count_check
    check (cardinality(primary_activity_regions) <= 12),
  add constraint photographer_applications_bio_length_check
    check (bio is null or char_length(bio) <= 1000),
  add constraint photographer_applications_rejection_reason_required_check
    check (status <> 'rejected' or (rejection_reason is not null and char_length(trim(rejection_reason)) > 0)),
  add constraint photographer_applications_review_state_consistency_check
    check (
      (
        status = 'pending'
        and admin_note is null
        and rejection_reason is null
        and reviewed_by is null
        and reviewed_at is null
      )
      or (
        status = 'approved'
        and reviewed_by is not null
        and reviewed_at is not null
        and rejection_reason is null
      )
      or (
        status = 'rejected'
        and reviewed_by is not null
        and reviewed_at is not null
        and rejection_reason is not null
        and char_length(trim(rejection_reason)) > 0
      )
    );

create unique index if not exists photographer_applications_one_pending_idx
  on public.photographer_applications(profile_id)
  where status = 'pending';

create index if not exists photographer_applications_profile_created_idx
  on public.photographer_applications(profile_id, created_at desc);

create index if not exists photographer_applications_status_created_idx
  on public.photographer_applications(status, created_at desc);

create index if not exists profiles_photographer_status_idx
  on public.profiles(photographer_status);

update public.profiles
set photographer_status = case
  when role = 'photographer' or roles @> array['photographer']::text[] then 'approved'
  else 'none'
end
where photographer_status = 'none';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'buyer');
begin
  insert into public.profiles (id, full_name, role, roles, organization, photographer_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'buyer',
    array['buyer']::text[],
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization', '')), ''),
    case when requested_role = 'photographer' then 'pending' else 'none' end
  );
  return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  actor_is_admin boolean := false;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if actor_id is null then
    return new;
  end if;

  select coalesce(is_admin, false)
  into actor_is_admin
  from public.profiles
  where id = actor_id;

  if actor_is_admin then
    return new;
  end if;

  if old.role is distinct from new.role
    or old.roles is distinct from new.roles
    or old.is_admin is distinct from new.is_admin
    or old.photographer_status is distinct from new.photographer_status then
    raise exception 'profile role and approval fields are admin-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
create trigger prevent_profile_privilege_escalation
  before update of role, roles, is_admin, photographer_status on public.profiles
  for each row execute procedure public.prevent_profile_privilege_escalation();

create or replace function public.normalize_photographer_application_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  new.applicant_name := trim(regexp_replace(new.applicant_name, '\s+', ' ', 'g'));
  new.organization := nullif(trim(regexp_replace(coalesce(new.organization, ''), '\s+', ' ', 'g')), '');
  new.phone_number := nullif(trim(regexp_replace(coalesce(new.phone_number, ''), '\s+', ' ', 'g')), '');
  new.bio := nullif(trim(new.bio), '');
  new.status := 'pending';
  new.admin_note := null;
  new.rejection_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  new.updated_at := null;

  if exists (
    select 1
    from public.profiles
    where id = new.profile_id
      and photographer_status = 'approved'
      and coalesce(is_admin, false) = false
  ) then
    raise exception 'approved photographers cannot create pending applications';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_photographer_application_insert on public.photographer_applications;
create trigger normalize_photographer_application_insert
  before insert on public.photographer_applications
  for each row execute procedure public.normalize_photographer_application_insert();

create or replace function public.set_photographer_application_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_photographer_application_updated_at on public.photographer_applications;
create trigger set_photographer_application_updated_at
  before update on public.photographer_applications
  for each row execute procedure public.set_photographer_application_updated_at();

create or replace function public.sync_photographer_application_insert_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    update public.profiles
    set
      photographer_status = 'pending',
      updated_at = now()
    where id = new.profile_id
      and photographer_status in ('none', 'suspended');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_photographer_application_insert_status on public.photographer_applications;
create trigger sync_photographer_application_insert_status
  after insert on public.photographer_applications
  for each row execute procedure public.sync_photographer_application_insert_status();

create or replace function public.sync_photographer_application_review_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'approved' then
    update public.profiles
    set
      photographer_status = 'approved',
      role = 'photographer',
      roles = array['buyer', 'photographer']::text[],
      updated_at = now()
    where id = new.profile_id;
  elsif new.status = 'rejected' then
    update public.profiles
    set
      photographer_status = 'suspended',
      updated_at = now()
    where id = new.profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_photographer_application_review_status on public.photographer_applications;
create trigger sync_photographer_application_review_status
  after update of status on public.photographer_applications
  for each row execute procedure public.sync_photographer_application_review_status();

drop policy if exists "images: photographer insert" on public.images;
drop policy if exists "images: photographer update own" on public.images;

create policy "images: photographer insert"
  on public.images for insert
  with check (
    auth.uid() = photographer_id
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and photographer_status = 'approved'
    )
  );

create policy "images: photographer update own"
  on public.images for update
  using (
    auth.uid() = photographer_id
    and status in ('draft', 'pending')
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and photographer_status = 'approved'
    )
  )
  with check (
    auth.uid() = photographer_id
    and status in ('draft', 'pending')
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and photographer_status = 'approved'
    )
  );

drop policy if exists "images-original: owner upload" on storage.objects;
drop policy if exists "images-full: owner upload" on storage.objects;

create policy "images-original: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'images-original'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and photographer_status = 'approved'
    )
  );

create policy "images-full: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'images-full'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and photographer_status = 'approved'
    )
  );

alter table public.photographer_applications enable row level security;

drop policy if exists "photographer_applications: self select" on public.photographer_applications;
drop policy if exists "photographer_applications: self insert pending" on public.photographer_applications;
drop policy if exists "photographer_applications: admin all" on public.photographer_applications;

create policy "photographer_applications: self insert pending"
  on public.photographer_applications for insert
  with check (
    profile_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and photographer_status in ('none', 'suspended')
    )
  );

create policy "photographer_applications: admin all"
  on public.photographer_applications for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop view if exists public.photographer_application_statuses;

create view public.photographer_application_statuses as
select
  id,
  profile_id,
  status,
  applicant_name,
  organization,
  phone_number,
  primary_activity_regions,
  bio,
  rejection_reason,
  reviewed_at,
  created_at,
  updated_at
from public.photographer_applications
where profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );

grant select on public.photographer_application_statuses to authenticated;
