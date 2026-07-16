-- IMAGE PARTNERS - Library guidance messages and orientation filtering

alter table public.contact_submissions
  drop constraint if exists contact_submissions_photo_required_check;

alter table public.contact_submissions
  add constraint contact_submissions_photo_required_check
    check (
      inquiry_type <> 'photo_request'
      or (
        requester_phone is not null
        and char_length(trim(requester_phone)) > 0
        and usage_project is not null
        and char_length(usage_project) > 0
        and usage_context is not null
        and char_length(usage_context) > 0
        and deadline_at is not null
      )
    ) not valid;

alter table public.images
  add column if not exists orientation_class text generated always as (
    case
      when width is null or height is null or width <= 0 or height <= 0 then null
      when upload_rotation_degrees in (90, 270) and height > width then 'landscape'
      when upload_rotation_degrees in (90, 270) and height < width then 'portrait'
      when upload_rotation_degrees in (90, 270) then 'square'
      when width > height then 'landscape'
      when width < height then 'portrait'
      else 'square'
    end
  ) stored;

create index if not exists images_orientation_published_idx
  on public.images(orientation_class, created_at desc)
  where status = 'approved' and lifecycle_status = 'active' and is_published = true;

create table if not exists public.library_guidance_messages (
  id uuid primary key default gen_random_uuid(),
  content_ko text not null,
  content_en text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint library_guidance_content_ko_length_check
    check (char_length(trim(content_ko)) between 1 and 160),
  constraint library_guidance_content_en_length_check
    check (content_en is null or char_length(trim(content_en)) <= 160)
);

alter table public.library_guidance_messages enable row level security;

drop policy if exists "library_guidance: public select active" on public.library_guidance_messages;
create policy "library_guidance: public select active"
  on public.library_guidance_messages for select
  using (is_active = true);

drop policy if exists "library_guidance: admin all" on public.library_guidance_messages;
create policy "library_guidance: admin all"
  on public.library_guidance_messages for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

insert into public.library_guidance_messages (content_ko, content_en)
select '퍼블리셔를 위한 정확한 이미지', 'Curated imagery for publishers'
where not exists (select 1 from public.library_guidance_messages);
