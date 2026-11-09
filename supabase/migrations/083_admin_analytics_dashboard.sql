-- Image Partners administrator analytics dashboard.
-- Aggregates first-party activity without exposing raw identifiers to the browser.

create index if not exists user_events_created_idx
  on public.user_events(created_at desc);

create index if not exists profiles_created_idx
  on public.profiles(created_at desc);

create index if not exists orders_completed_at_idx
  on public.orders(completed_at desc)
  where status = 'completed';

create or replace function public.admin_analytics_dashboard(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with
settings as (
  select least(greatest(coalesce(p_days, 7), 1), 90) as days
),
period as (
  select
    days,
    (
      date_trunc('day', timezone('Asia/Seoul', now()))
      - make_interval(days => days - 1)
    ) at time zone 'Asia/Seoul' as start_at,
    now() as end_at
  from settings
),
boundaries as (
  select
    days,
    start_at,
    end_at,
    start_at - make_interval(days => days) as previous_start_at
  from period
),
filtered_events as (
  select
    event.*,
    coalesce(
      'user:' || event.user_id::text,
      'session:' || nullif(event.session_id, ''),
      'ip:' || nullif(event.ip_hash, '')
    ) as visitor_key,
    timezone('Asia/Seoul', event.created_at)::date as local_date
  from public.user_events event
  cross join boundaries boundary
  where event.created_at >= boundary.previous_start_at
    and event.created_at < boundary.end_at
    and coalesce(event.path, '') !~ '^/admin(?:/|$)'
    and coalesce(event.user_agent, '') !~* (
      'bot|crawler|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|'
      || 'facebookexternalhit|twitterbot|linkedinbot|discordbot|whatsapp|curl|wget|'
      || 'python-requests|postmanruntime|insomnia'
    )
    and coalesce(event.referrer, '') !~* (
      '(^|[/:.])(localhost|127[.]0[.]0[.]1)([:/]|$)|[.]vercel[.]app|[.]pages[.]dev'
    )
),
current_events as (
  select event.*
  from filtered_events event
  cross join boundaries boundary
  where event.created_at >= boundary.start_at
),
previous_events as (
  select event.*
  from filtered_events event
  cross join boundaries boundary
  where event.created_at >= boundary.previous_start_at
    and event.created_at < boundary.start_at
),
current_event_summary as (
  select
    count(distinct visitor_key) filter (where visitor_key is not null) as visitors,
    count(distinct coalesce(nullif(session_id, ''), visitor_key || ':' || local_date::text))
      filter (where visitor_key is not null) as sessions,
    count(*) filter (where event_type = 'page_view') as page_views,
    count(*) filter (where event_type = 'image_view') as image_views,
    count(*) filter (where event_type = 'search') as searches,
    count(*) filter (where event_type = 'download') as downloads
  from current_events
),
previous_event_summary as (
  select
    count(distinct visitor_key) filter (where visitor_key is not null) as visitors,
    count(distinct coalesce(nullif(session_id, ''), visitor_key || ':' || local_date::text))
      filter (where visitor_key is not null) as sessions,
    count(*) filter (where event_type = 'page_view') as page_views,
    count(*) filter (where event_type = 'image_view') as image_views,
    count(*) filter (where event_type = 'search') as searches,
    count(*) filter (where event_type = 'download') as downloads
  from previous_events
),
current_orders as (
  select orders.*
  from public.orders orders
  cross join boundaries boundary
  where orders.status = 'completed'
    and orders.completed_at >= boundary.start_at
    and orders.completed_at < boundary.end_at
),
previous_orders as (
  select orders.*
  from public.orders orders
  cross join boundaries boundary
  where orders.status = 'completed'
    and orders.completed_at >= boundary.previous_start_at
    and orders.completed_at < boundary.start_at
),
current_members as (
  select count(*) as count
  from public.profiles profile
  cross join boundaries boundary
  where profile.created_at >= boundary.start_at
    and profile.created_at < boundary.end_at
),
previous_members as (
  select count(*) as count
  from public.profiles profile
  cross join boundaries boundary
  where profile.created_at >= boundary.previous_start_at
    and profile.created_at < boundary.start_at
),
calendar as (
  select generate_series(
    timezone('Asia/Seoul', boundary.start_at)::date,
    timezone('Asia/Seoul', boundary.end_at)::date,
    interval '1 day'
  )::date as date
  from boundaries boundary
),
daily_events as (
  select
    calendar.date,
    count(distinct event.visitor_key) filter (where event.visitor_key is not null) as visitors,
    count(*) filter (where event.event_type = 'page_view') as page_views,
    count(*) filter (where event.event_type = 'image_view') as image_views,
    count(*) filter (where event.event_type = 'search') as searches
  from calendar
  left join current_events event on event.local_date = calendar.date
  group by calendar.date
),
daily_orders as (
  select
    timezone('Asia/Seoul', orders.completed_at)::date as date,
    count(*) as orders,
    coalesce(sum(orders.total_krw), 0) as revenue
  from current_orders orders
  group by timezone('Asia/Seoul', orders.completed_at)::date
),
daily as (
  select
    daily_events.date,
    daily_events.visitors,
    daily_events.page_views,
    daily_events.image_views,
    daily_events.searches,
    coalesce(daily_orders.orders, 0) as orders,
    coalesce(daily_orders.revenue, 0) as revenue
  from daily_events
  left join daily_orders using (date)
  order by daily_events.date
),
current_visitors as (
  select distinct on (event.visitor_key)
    event.visitor_key,
    event.user_id,
    event.user_agent
  from current_events event
  where event.visitor_key is not null
  order by event.visitor_key, event.created_at desc
),
first_seen as (
  select
    coalesce(
      'user:' || event.user_id::text,
      'session:' || nullif(event.session_id, ''),
      'ip:' || nullif(event.ip_hash, '')
    ) as visitor_key,
    min(event.created_at) as first_seen_at
  from public.user_events event
  where coalesce(event.path, '') !~ '^/admin(?:/|$)'
  group by 1
),
audience as (
  select
    count(*) filter (where visitor.user_id is not null) as logged_in,
    count(*) filter (where visitor.user_id is null) as guests,
    count(*) filter (where first_seen.first_seen_at >= boundary.start_at) as new_visitors,
    count(*) filter (where first_seen.first_seen_at < boundary.start_at) as returning_visitors,
    count(*) filter (where visitor.user_agent ~* 'mobile|android|iphone|ipad') as mobile,
    count(*) filter (
      where visitor.user_agent is null
        or visitor.user_agent !~* 'mobile|android|iphone|ipad'
    ) as desktop
  from current_visitors visitor
  left join first_seen using (visitor_key)
  cross join boundaries boundary
),
funnel as (
  select
    count(distinct visitor_key) filter (where visitor_key is not null) as visitors,
    count(distinct visitor_key) filter (where visitor_key is not null and event_type = 'image_view') as image_viewers,
    count(distinct visitor_key) filter (where visitor_key is not null and event_type = 'cart_add') as cart_users,
    count(distinct visitor_key) filter (where visitor_key is not null and event_type = 'checkout_started') as checkout_users
  from current_events
),
top_pages as (
  select path, count(*) as views
  from current_events
  where event_type = 'page_view'
    and nullif(trim(path), '') is not null
  group by path
  order by views desc, path
  limit 7
),
top_images as (
  select
    event.image_id as id,
    coalesce(image.title_ko, image.title, '제목 없음') as title,
    image.asset_id,
    count(*) as views
  from current_events event
  left join public.images image on image.id = event.image_id
  where event.event_type = 'image_view'
    and event.image_id is not null
  group by event.image_id, image.title_ko, image.title, image.asset_id
  order by views desc, title
  limit 7
),
top_searches as (
  select
    trim(metadata ->> 'query') as query,
    count(*) as searches
  from current_events
  where event_type = 'search'
    and nullif(trim(metadata ->> 'query'), '') is not null
  group by trim(metadata ->> 'query')
  order by searches desc, query
  limit 7
),
zero_result_searches as (
  select
    trim(metadata ->> 'query') as query,
    count(*) as searches
  from current_events
  where event_type = 'search'
    and nullif(trim(metadata ->> 'query'), '') is not null
    and coalesce(metadata ->> 'resultCount', '') ~ '^[0-9]+$'
    and (metadata ->> 'resultCount')::integer = 0
  group by trim(metadata ->> 'query')
  order by searches desc, query
  limit 7
),
orders_summary as (
  select count(*) as orders, count(distinct buyer_id) as purchasers, coalesce(sum(total_krw), 0) as revenue
  from current_orders
),
previous_orders_summary as (
  select count(*) as orders, count(distinct buyer_id) as purchasers, coalesce(sum(total_krw), 0) as revenue
  from previous_orders
)
select jsonb_build_object(
  'range', jsonb_build_object(
    'days', boundary.days,
    'start', boundary.start_at,
    'end', boundary.end_at,
    'timezone', 'Asia/Seoul'
  ),
  'summary', jsonb_build_object(
    'visitors', current_event_summary.visitors,
    'sessions', current_event_summary.sessions,
    'pageViews', current_event_summary.page_views,
    'imageViews', current_event_summary.image_views,
    'searches', current_event_summary.searches,
    'downloads', current_event_summary.downloads,
    'newMembers', current_members.count,
    'completedOrders', orders_summary.orders,
    'revenue', orders_summary.revenue
  ),
  'previous', jsonb_build_object(
    'visitors', previous_event_summary.visitors,
    'sessions', previous_event_summary.sessions,
    'pageViews', previous_event_summary.page_views,
    'imageViews', previous_event_summary.image_views,
    'searches', previous_event_summary.searches,
    'downloads', previous_event_summary.downloads,
    'newMembers', previous_members.count,
    'completedOrders', previous_orders_summary.orders,
    'revenue', previous_orders_summary.revenue
  ),
  'daily', coalesce((select jsonb_agg(to_jsonb(daily) order by daily.date) from daily), '[]'::jsonb),
  'funnel', jsonb_build_object(
    'visitors', funnel.visitors,
    'imageViewers', funnel.image_viewers,
    'cartUsers', funnel.cart_users,
    'checkoutUsers', funnel.checkout_users,
    'purchasers', orders_summary.purchasers
  ),
  'audience', to_jsonb(audience),
  'topPages', coalesce((select jsonb_agg(to_jsonb(top_pages)) from top_pages), '[]'::jsonb),
  'topImages', coalesce((select jsonb_agg(to_jsonb(top_images)) from top_images), '[]'::jsonb),
  'topSearches', coalesce((select jsonb_agg(to_jsonb(top_searches)) from top_searches), '[]'::jsonb),
  'zeroResultSearches', coalesce((select jsonb_agg(to_jsonb(zero_result_searches)) from zero_result_searches), '[]'::jsonb),
  'filters', jsonb_build_object(
    'bots', true,
    'adminPaths', true,
    'developmentHosts', true
  )
)
from boundaries boundary
cross join current_event_summary
cross join previous_event_summary
cross join current_members
cross join previous_members
cross join orders_summary
cross join previous_orders_summary
cross join funnel
cross join audience;
$$;

revoke all on function public.admin_analytics_dashboard(integer) from public, anon, authenticated;
grant execute on function public.admin_analytics_dashboard(integer) to service_role;
