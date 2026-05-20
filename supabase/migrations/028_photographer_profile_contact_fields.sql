-- IMAGE PARTNERS - Photographer profile contact fields

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists primary_activity_regions text[] default '{}'::text[];

update public.profiles
set primary_activity_regions = '{}'::text[]
where primary_activity_regions is null;

alter table public.profiles
  alter column primary_activity_regions set default '{}'::text[],
  alter column primary_activity_regions set not null;

alter table public.profiles
  drop constraint if exists profiles_phone_number_length_check,
  drop constraint if exists profiles_primary_activity_regions_count_check;

alter table public.profiles
  add constraint profiles_phone_number_length_check
    check (phone_number is null or char_length(phone_number) <= 32),
  add constraint profiles_primary_activity_regions_count_check
    check (cardinality(primary_activity_regions) <= 12);

create index if not exists profiles_primary_activity_regions_gin_idx
  on public.profiles using gin(primary_activity_regions);
