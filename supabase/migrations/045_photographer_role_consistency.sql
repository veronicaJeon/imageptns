-- IMAGE PARTNERS - Photographer role consistency

update public.profiles
set
  role = 'photographer',
  roles = array['buyer', 'photographer']::text[],
  updated_at = now()
where photographer_status = 'approved'
  and (
    role <> 'photographer'
    or roles is null
    or not coalesce(roles @> array['buyer', 'photographer']::text[], false)
  );

alter table public.profiles
  drop constraint if exists profiles_approved_photographer_role_check;

alter table public.profiles
  add constraint profiles_approved_photographer_role_check
  check (
    photographer_status <> 'approved'
    or (
      role = 'photographer'
      and coalesce(roles @> array['buyer', 'photographer']::text[], false)
    )
  );
