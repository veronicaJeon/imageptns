-- IMAGE PARTNERS - soft delete support for user operations

alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx
  on public.profiles(deleted_at);
