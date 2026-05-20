-- IMAGE PARTNERS - Profile withdrawal review workflow

create table if not exists public.profile_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  requester_role text not null default 'admin',
  status text not null default 'pending',
  impact_snapshot jsonb not null default '{}'::jsonb,
  admin_note text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint profile_withdrawal_requests_requester_role_check
    check (requester_role in ('admin', 'photographer')),
  constraint profile_withdrawal_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled'))
);

create index if not exists profile_withdrawal_requests_status_created_idx
  on public.profile_withdrawal_requests(status, created_at desc);

create index if not exists profile_withdrawal_requests_target_idx
  on public.profile_withdrawal_requests(target_profile_id, created_at desc);

create index if not exists profile_withdrawal_requests_requester_idx
  on public.profile_withdrawal_requests(requester_id, created_at desc);

alter table public.profile_withdrawal_requests enable row level security;

drop policy if exists "profile_withdrawal_requests: admin all" on public.profile_withdrawal_requests;
create policy "profile_withdrawal_requests: admin all"
  on public.profile_withdrawal_requests for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
