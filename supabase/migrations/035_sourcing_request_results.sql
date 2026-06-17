-- IMAGE PARTNERS - Buyer sourcing request results

alter table public.contact_submissions
  add column if not exists buyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists sourcing_purposes text[] not null default '{}'::text[],
  add column if not exists internal_sourcing_status text not null default 'submitted',
  add column if not exists buyer_sourcing_status text not null default 'received';

alter table public.contact_submissions
  drop constraint if exists contact_submissions_sourcing_purposes_check,
  drop constraint if exists contact_submissions_internal_sourcing_status_check,
  drop constraint if exists contact_submissions_buyer_sourcing_status_check;

alter table public.contact_submissions
  add constraint contact_submissions_sourcing_purposes_check
    check (
      sourcing_purposes <@ array['rights_check','similar_search','supply_check']::text[]
      and cardinality(sourcing_purposes) <= 3
    ),
  add constraint contact_submissions_internal_sourcing_status_check
    check (internal_sourcing_status in (
      'submitted','rights_check_needed','similar_searching','supply_checking',
      'drafting','ready_to_send','answered','closed','on_hold','unavailable'
    )),
  add constraint contact_submissions_buyer_sourcing_status_check
    check (buyer_sourcing_status in ('received','under_review','answer_ready','closed'));

create index if not exists contact_submissions_buyer_sourcing_idx
  on public.contact_submissions(buyer_id, created_at desc)
  where inquiry_type = 'photo_request';

create table if not exists public.sourcing_request_answers (
  id uuid primary key default gen_random_uuid(),
  contact_submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  answer_text text,
  rights_result text,
  rights_explanation text,
  status text not null default 'draft',
  revision_round integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint sourcing_request_answers_status_check
    check (status in ('draft','published')),
  constraint sourcing_request_answers_rights_result_check
    check (rights_result is null or rights_result in ('usable','conditional','unverified','not_recommended')),
  constraint sourcing_request_answers_revision_round_check
    check (revision_round >= 0 and revision_round <= 3)
);

create index if not exists sourcing_request_answers_submission_idx
  on public.sourcing_request_answers(contact_submission_id, created_at desc);

create table if not exists public.sourcing_request_candidates (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.sourcing_request_answers(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade,
  sort_order integer not null default 0,
  is_visible boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint sourcing_request_candidates_unique_image unique (answer_id, image_id)
);

create index if not exists sourcing_request_candidates_answer_order_idx
  on public.sourcing_request_candidates(answer_id, sort_order asc, created_at asc);

create table if not exists public.sourcing_request_revisions (
  id uuid primary key default gen_random_uuid(),
  contact_submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  round integer not null,
  reasons text[] not null default '{}'::text[],
  message text not null,
  created_at timestamptz not null default now(),
  constraint sourcing_request_revisions_round_check
    check (round >= 1 and round <= 3),
  constraint sourcing_request_revisions_reasons_check
    check (reasons <@ array[
      'wrong_location','wrong_season_or_time','wrong_composition',
      'usage_terms_do_not_fit','price_does_not_fit','need_more_candidates','other'
    ]::text[])
);

create index if not exists sourcing_request_revisions_submission_idx
  on public.sourcing_request_revisions(contact_submission_id, round asc);

alter table public.sourcing_request_answers enable row level security;
alter table public.sourcing_request_candidates enable row level security;
alter table public.sourcing_request_revisions enable row level security;

drop policy if exists "sourcing answers: admin all" on public.sourcing_request_answers;
create policy "sourcing answers: admin all"
  on public.sourcing_request_answers for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "sourcing candidates: admin all" on public.sourcing_request_candidates;
create policy "sourcing candidates: admin all"
  on public.sourcing_request_candidates for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "sourcing revisions: admin all" on public.sourcing_request_revisions;
create policy "sourcing revisions: admin all"
  on public.sourcing_request_revisions for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "sourcing answers: buyer select published own" on public.sourcing_request_answers;
create policy "sourcing answers: buyer select published own"
  on public.sourcing_request_answers for select
  using (
    status = 'published'
    and exists (
      select 1 from public.contact_submissions c
      where c.id = sourcing_request_answers.contact_submission_id
        and c.inquiry_type = 'photo_request'
        and (c.buyer_id = auth.uid() or c.email = (select email from auth.users where id = auth.uid()))
    )
  );

drop policy if exists "sourcing candidates: buyer select visible own" on public.sourcing_request_candidates;
create policy "sourcing candidates: buyer select visible own"
  on public.sourcing_request_candidates for select
  using (
    is_visible = true
    and exists (
      select 1
      from public.sourcing_request_answers a
      join public.contact_submissions c on c.id = a.contact_submission_id
      where a.id = sourcing_request_candidates.answer_id
        and a.status = 'published'
        and (c.buyer_id = auth.uid() or c.email = (select email from auth.users where id = auth.uid()))
    )
  );

drop policy if exists "sourcing revisions: buyer insert own" on public.sourcing_request_revisions;
create policy "sourcing revisions: buyer insert own"
  on public.sourcing_request_revisions for insert
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.contact_submissions c
      where c.id = sourcing_request_revisions.contact_submission_id
        and c.inquiry_type = 'photo_request'
        and (c.buyer_id = auth.uid() or c.email = (select email from auth.users where id = auth.uid()))
    )
  );
