-- ============================================================
-- Admin user management and login counters
-- ============================================================

alter table public.profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists login_count integer not null default 0;

create index if not exists profiles_is_admin_idx
  on public.profiles(is_admin)
  where is_admin = true;

create index if not exists profiles_last_login_idx
  on public.profiles(last_login_at desc);

create or replace function public.record_profile_login(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set
    last_login_at = now(),
    login_count = coalesce(login_count, 0) + 1,
    updated_at = now()
  where id = target_user_id;
end;
$$;

alter table public.orders
  alter column buyer_id drop not null;

alter table public.orders
  drop constraint if exists orders_buyer_id_fkey;

alter table public.orders
  add constraint orders_buyer_id_fkey
  foreign key (buyer_id) references public.profiles(id) on delete set null;

alter table public.downloads
  alter column user_id drop not null;

alter table public.downloads
  drop constraint if exists downloads_user_id_fkey;

alter table public.downloads
  add constraint downloads_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
