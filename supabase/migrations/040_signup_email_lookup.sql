-- IMAGE PARTNERS - Auth signup email lookup
-- Lets trusted server code distinguish unregistered, unconfirmed, and confirmed emails
-- before presenting signup guidance. Do not grant this to anon/authenticated clients.

create or replace function public.lookup_auth_user_by_email(lookup_email text)
returns table (
  user_exists boolean,
  email_confirmed boolean,
  providers text[]
)
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  return query
  select
    true as user_exists,
    u.email_confirmed_at is not null as email_confirmed,
    coalesce(
      array_agg(distinct i.provider) filter (where i.provider is not null),
      array[]::text[]
    ) as providers
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  where lower(u.email) = lower(trim(lookup_email))
  group by u.id, u.email_confirmed_at
  limit 1;

  if not found then
    return query select false, false, array[]::text[];
  end if;
end;
$$;

revoke all on function public.lookup_auth_user_by_email(text) from public;
revoke all on function public.lookup_auth_user_by_email(text) from anon;
revoke all on function public.lookup_auth_user_by_email(text) from authenticated;
grant execute on function public.lookup_auth_user_by_email(text) to service_role;
