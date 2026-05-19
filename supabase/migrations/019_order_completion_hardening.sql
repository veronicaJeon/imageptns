-- IMAGE PARTNERS - order completion hardening

drop trigger if exists on_order_item_created on public.order_items;
drop function if exists public.increment_sales_count();

create or replace function public.on_order_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status != 'completed' then
    insert into public.earnings_ledger (photographer_id, order_item_id, gross_krw, commission_krw, net_krw, period)
    select
      oi.photographer_id,
      oi.id,
      oi.gross_krw,
      oi.commission_krw,
      oi.net_krw,
      to_char(coalesce(new.completed_at, now()), 'YYYY-MM')
    from public.order_items oi
    where oi.order_id = new.id
      and oi.photographer_id is not null
    on conflict do nothing;

    insert into public.downloads (order_item_id, user_id)
    select oi.id, new.buyer_id
    from public.order_items oi
    where oi.order_id = new.id
    on conflict do nothing;

    update public.images i
    set sales_count = sales_count + completed.count,
        updated_at = now()
    from (
      select image_id, count(*)::integer as count
      from public.order_items
      where order_id = new.id
      group by image_id
    ) completed
    where i.id = completed.image_id;
  end if;

  return new;
end;
$$;

create unique index if not exists downloads_order_item_unique_idx
  on public.downloads(order_item_id);

create unique index if not exists earnings_order_item_unique_idx
  on public.earnings_ledger(order_item_id);
