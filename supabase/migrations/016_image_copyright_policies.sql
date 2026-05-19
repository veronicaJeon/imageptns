-- IMAGE PARTNERS - Image copyright and Creative Commons policy

alter table public.images
  add column if not exists copyright_license text not null default 'standard',
  add column if not exists free_usage_policy text not null default 'none',
  add column if not exists attribution_name text,
  add column if not exists attribution_url text;

alter table public.images
  drop constraint if exists images_copyright_license_check,
  drop constraint if exists images_free_usage_policy_check;

alter table public.images
  add constraint images_copyright_license_check
  check (copyright_license in (
    'standard',
    'cc0',
    'cc_by',
    'cc_by_sa',
    'cc_by_nc',
    'cc_by_nc_sa',
    'cc_by_nd',
    'cc_by_nc_nd'
  ));

alter table public.images
  add constraint images_free_usage_policy_check
  check (free_usage_policy in ('none','all','education'));

create index if not exists images_copyright_license_idx
  on public.images(copyright_license);

create index if not exists images_free_usage_policy_idx
  on public.images(free_usage_policy);
