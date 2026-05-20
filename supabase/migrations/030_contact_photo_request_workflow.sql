-- IMAGE PARTNERS - Contact-backed photo request workflow

alter table public.contact_submissions
  add column if not exists inquiry_type text not null default 'general',
  add column if not exists location_label text,
  add column if not exists target_regions text[] not null default '{}'::text[],
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists usage_intent text,
  add column if not exists license_intent text,
  add column if not exists budget_min_krw integer,
  add column if not exists budget_max_krw integer,
  add column if not exists deadline_at timestamptz,
  add column if not exists reference_url text,
  add column if not exists reference_note text,
  add column if not exists non_copying_attested boolean not null default false,
  add column if not exists request_status text not null default 'submitted';

alter table public.contact_submissions
  drop constraint if exists contact_submissions_inquiry_type_check,
  drop constraint if exists contact_submissions_request_status_check,
  drop constraint if exists contact_submissions_photo_budget_check,
  drop constraint if exists contact_submissions_photo_array_count_check,
  drop constraint if exists contact_submissions_photo_field_length_check,
  drop constraint if exists contact_submissions_photo_required_check;

alter table public.contact_submissions
  add constraint contact_submissions_inquiry_type_check
    check (inquiry_type in ('general','photo_request')),
  add constraint contact_submissions_request_status_check
    check (request_status in ('submitted','matching','in_progress','fulfilled','cancelled','rejected')),
  add constraint contact_submissions_photo_budget_check
    check (
      (budget_min_krw is null or budget_min_krw >= 0)
      and (budget_max_krw is null or budget_max_krw >= 0)
      and (budget_min_krw is null or budget_max_krw is null or budget_min_krw <= budget_max_krw)
    ),
  add constraint contact_submissions_photo_array_count_check
    check (cardinality(target_regions) <= 12 and cardinality(tags) <= 20),
  add constraint contact_submissions_photo_field_length_check
    check (
      (location_label is null or char_length(location_label) <= 160)
      and (category is null or char_length(category) <= 80)
      and (usage_intent is null or char_length(usage_intent) <= 500)
      and (license_intent is null or char_length(license_intent) <= 240)
      and (reference_url is null or char_length(reference_url) <= 2048)
      and (reference_note is null or char_length(reference_note) <= 1000)
    ),
  add constraint contact_submissions_photo_required_check
    check (
      inquiry_type <> 'photo_request'
      or (
        location_label is not null
        and char_length(location_label) > 0
        and cardinality(target_regions) > 0
        and usage_intent is not null
        and char_length(usage_intent) > 0
        and license_intent is not null
        and char_length(license_intent) > 0
        and budget_min_krw is not null
        and budget_max_krw is not null
        and deadline_at is not null
        and non_copying_attested = true
      )
    );

create index if not exists contact_submissions_inquiry_type_created_idx
  on public.contact_submissions(inquiry_type, created_at desc);

create index if not exists contact_submissions_photo_request_status_idx
  on public.contact_submissions(request_status, created_at desc)
  where inquiry_type = 'photo_request';

create index if not exists contact_submissions_target_regions_gin_idx
  on public.contact_submissions using gin(target_regions);

drop policy if exists "contact: admin all" on public.contact_submissions;
create policy "contact: admin all"
  on public.contact_submissions for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create table if not exists public.photo_request_matches (
  id uuid primary key default gen_random_uuid(),
  contact_submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'candidate',
  score integer not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint photo_request_matches_status_check
    check (status in ('candidate','invited','interested','declined','selected','cancelled')),
  constraint photo_request_matches_score_check
    check (score >= 0 and score <= 100),
  constraint photo_request_matches_unique_photographer
    unique (contact_submission_id, photographer_id)
);

create index if not exists photo_request_matches_submission_idx
  on public.photo_request_matches(contact_submission_id, created_at desc);

create index if not exists photo_request_matches_photographer_status_idx
  on public.photo_request_matches(photographer_id, status, created_at desc);

create index if not exists photo_request_matches_status_idx
  on public.photo_request_matches(status, created_at desc);

alter table public.photo_request_matches enable row level security;

drop policy if exists "photo_request_matches: photographer select assigned" on public.photo_request_matches;
create policy "photo_request_matches: photographer select assigned"
  on public.photo_request_matches for select
  using (photographer_id = auth.uid());

drop policy if exists "photo_request_matches: photographer update response" on public.photo_request_matches;
create policy "photo_request_matches: photographer update response"
  on public.photo_request_matches for update
  using (photographer_id = auth.uid())
  with check (photographer_id = auth.uid() and status in ('interested','declined'));

drop policy if exists "contact: photographer select matched photo requests" on public.contact_submissions;
create policy "contact: photographer select matched photo requests"
  on public.contact_submissions for select
  using (
    inquiry_type = 'photo_request'
    and exists (
      select 1
      from public.photo_request_matches m
      where m.contact_submission_id = contact_submissions.id
        and m.photographer_id = auth.uid()
    )
  );

drop policy if exists "photo_request_matches: admin all" on public.photo_request_matches;
create policy "photo_request_matches: admin all"
  on public.photo_request_matches for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
