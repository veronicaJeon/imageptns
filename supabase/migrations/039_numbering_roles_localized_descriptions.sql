-- IMAGE PARTNERS - scalable numbering, explicit profile roles, localized image copy

-- 1) Expand public-facing sequence labels to 12 digits.
create or replace function public.generate_asset_id()
returns trigger language plpgsql as $$
begin
  if new.asset_id is null then
    new.asset_id := 'IP-' || lpad(nextval('image_asset_seq')::text, 12, '0');
  end if;
  return new;
end;
$$;

create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'ORD-' || lpad(nextval('order_seq')::text, 12, '0');
  end if;
  return new;
end;
$$;

update public.images
set asset_id = 'IP-' || lpad(substring(asset_id from '^IP-([0-9]+)$'), 12, '0')
where asset_id ~ '^IP-[0-9]+$'
  and length(substring(asset_id from '^IP-([0-9]+)$')) < 12;

update public.orders
set order_number = 'ORD-' || lpad(substring(order_number from '^ORD-([0-9]+)$'), 12, '0')
where order_number ~ '^ORD-[0-9]+$'
  and length(substring(order_number from '^ORD-([0-9]+)$')) < 12;

update public.order_items oi
set image_asset_id_snapshot = i.asset_id
from public.images i
where oi.image_id = i.id
  and oi.image_asset_id_snapshot is distinct from i.asset_id;

select setval(
  'public.image_asset_seq',
  greatest(
    coalesce((select max((substring(asset_id from '^IP-([0-9]+)$'))::bigint) from public.images where asset_id ~ '^IP-[0-9]+$'), 0),
    1
  ),
  true
);

select setval(
  'public.order_seq',
  greatest(
    coalesce((select max((substring(order_number from '^ORD-([0-9]+)$'))::bigint) from public.orders where order_number ~ '^ORD-[0-9]+$'), 0),
    1
  ),
  true
);

-- 2) Make account roles explicit and multi-valued.
alter table public.profiles
  add column if not exists roles text[];

update public.profiles
set roles = case
  when roles is not null and cardinality(roles) > 0 then roles
  when role = 'photographer' then array['buyer', 'photographer']::text[]
  else array['buyer']::text[]
end;

alter table public.profiles
  alter column roles set default array['buyer']::text[],
  alter column roles set not null;

alter table public.profiles
  drop constraint if exists profiles_roles_check;

alter table public.profiles
  add constraint profiles_roles_check
  check (
    roles <@ array['buyer', 'photographer']::text[]
    and cardinality(roles) between 1 and 2
  );

create index if not exists profiles_roles_gin_idx
  on public.profiles using gin(roles);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'buyer');
  normalized_roles text[] := array['buyer']::text[];
begin
  if requested_role = 'photographer' then
    normalized_roles := array['buyer', 'photographer']::text[];
  end if;

  insert into public.profiles (id, full_name, role, roles, organization)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when requested_role = 'photographer' then 'photographer' else 'buyer' end,
    normalized_roles,
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization', '')), '')
  );
  return new;
end;
$$;

-- 3) Store localized image metadata while keeping existing fields as fallbacks.
alter table public.images
  add column if not exists title_ko text,
  add column if not exists title_en text,
  add column if not exists description_ko text,
  add column if not exists description_en text,
  add column if not exists tags_ko text[],
  add column if not exists tags_en text[];

update public.images
set
  title_ko = coalesce(title_ko, title),
  title_en = coalesce(title_en, title),
  description_ko = coalesce(description_ko, description),
  description_en = coalesce(description_en, description),
  tags_ko = coalesce(tags_ko, tags),
  tags_en = coalesce(tags_en, tags)
where title_ko is null
   or title_en is null
   or description_ko is null
   or description_en is null
   or tags_ko is null
   or tags_en is null;

create or replace function public.update_image_fts()
returns trigger language plpgsql as $$
begin
  new.fts := to_tsvector('simple',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.title_ko, '') || ' ' ||
    coalesce(new.title_en, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.description_ko, '') || ' ' ||
    coalesce(new.description_en, '') || ' ' ||
    coalesce(new.category, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '') || ' ' ||
    coalesce(array_to_string(new.tags_ko, ' '), '') || ' ' ||
    coalesce(array_to_string(new.tags_en, ' '), '')
  );
  return new;
end;
$$;

update public.images
set updated_at = coalesce(updated_at, now());

-- 4) Keep buyer-provided usage notes for free/editorial checkout.
alter table public.orders
  add column if not exists usage_purpose_note text;
