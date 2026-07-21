-- Execute the configured retention policy for operational records whose
-- deletion does not affect licenses, payments, copyright, or account access.

create table if not exists public.data_retention_runs (
  id uuid primary key default gen_random_uuid(),
  dry_run boolean not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists data_retention_runs_created_idx
  on public.data_retention_runs(created_at desc);

alter table public.data_retention_runs enable row level security;

drop policy if exists "data_retention_runs: admin select" on public.data_retention_runs;
create policy "data_retention_runs: admin select"
  on public.data_retention_runs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create or replace function public.run_data_retention_cleanup(dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings record;
  result jsonb;
  event_rows bigint := 0;
  presence_rows bigint := 0;
  ai_rows bigint := 0;
  audit_rows bigint := 0;
  image_request_rows bigint := 0;
  profile_request_rows bigint := 0;
  withdrawn_profile_candidates bigint := 0;
  inactive_profile_candidates bigint := 0;
  expired_download_candidates bigint := 0;
  old_transaction_candidates bigint := 0;
begin
  select
    personal_data_retention_days,
    transaction_history_retention_days,
    inactive_account_retention_days,
    audit_log_retention_days,
    deletion_request_retention_days
  into settings
  from public.platform_commerce_settings
  where id = true;

  if not found then
    raise exception 'Data lifecycle settings are not configured';
  end if;

  if dry_run then
    select count(*) into event_rows
    from public.user_events
    where created_at < now() - make_interval(days => settings.inactive_account_retention_days);

    select count(*) into presence_rows
    from public.user_presence
    where last_seen_at < now() - make_interval(days => settings.inactive_account_retention_days);

    select count(*) into ai_rows
    from public.ai_analysis_requests
    where created_at < now() - interval '31 days';

    select count(*) into audit_rows
    from public.admin_audit_logs
    where created_at < now() - make_interval(days => settings.audit_log_retention_days);

    select count(*) into image_request_rows
    from public.image_deletion_requests
    where status in ('completed', 'rejected', 'cancelled')
      and coalesce(completed_at, decided_at, updated_at, created_at)
        < now() - make_interval(days => settings.deletion_request_retention_days);

    select count(*) into profile_request_rows
    from public.profile_withdrawal_requests
    where status in ('completed', 'rejected', 'cancelled')
      and coalesce(completed_at, decided_at, updated_at, created_at)
        < now() - make_interval(days => settings.deletion_request_retention_days);
  else
    delete from public.user_events
    where created_at < now() - make_interval(days => settings.inactive_account_retention_days);
    get diagnostics event_rows = row_count;

    delete from public.user_presence
    where last_seen_at < now() - make_interval(days => settings.inactive_account_retention_days);
    get diagnostics presence_rows = row_count;

    delete from public.ai_analysis_requests
    where created_at < now() - interval '31 days';
    get diagnostics ai_rows = row_count;

    delete from public.admin_audit_logs
    where created_at < now() - make_interval(days => settings.audit_log_retention_days);
    get diagnostics audit_rows = row_count;

    delete from public.image_deletion_requests
    where status in ('completed', 'rejected', 'cancelled')
      and coalesce(completed_at, decided_at, updated_at, created_at)
        < now() - make_interval(days => settings.deletion_request_retention_days);
    get diagnostics image_request_rows = row_count;

    delete from public.profile_withdrawal_requests
    where status in ('completed', 'rejected', 'cancelled')
      and coalesce(completed_at, decided_at, updated_at, created_at)
        < now() - make_interval(days => settings.deletion_request_retention_days);
    get diagnostics profile_request_rows = row_count;
  end if;

  -- These records can carry legal, licensing, settlement, or access impact.
  -- Report them for review instead of deleting them automatically.
  select count(*) into withdrawn_profile_candidates
  from public.profiles
  where deleted_at is not null
    and deleted_at < now() - make_interval(days => settings.personal_data_retention_days);

  select count(*) into inactive_profile_candidates
  from public.profiles
  where deleted_at is null
    and coalesce(last_login_at, created_at)
      < now() - make_interval(days => settings.inactive_account_retention_days);

  select count(*) into expired_download_candidates
  from public.downloads
  where expires_at < now();

  select count(*) into old_transaction_candidates
  from public.orders
  where created_at < now() - make_interval(days => settings.transaction_history_retention_days);

  result := jsonb_build_object(
    'dryRun', dry_run,
    'deleted', jsonb_build_object(
      'userEvents', event_rows,
      'userPresence', presence_rows,
      'aiAnalysisRequests', ai_rows,
      'adminAuditLogs', audit_rows,
      'imageDeletionRequests', image_request_rows,
      'profileWithdrawalRequests', profile_request_rows
    ),
    'reviewCandidates', jsonb_build_object(
      'withdrawnProfiles', withdrawn_profile_candidates,
      'inactiveProfiles', inactive_profile_candidates,
      'expiredDownloads', expired_download_candidates,
      'oldTransactions', old_transaction_candidates
    )
  );

  if not dry_run then
    delete from public.data_retention_runs
    where created_at < now() - make_interval(days => settings.audit_log_retention_days);

    insert into public.data_retention_runs (dry_run, result)
    values (false, result);
  end if;

  return result;
end;
$$;

revoke all on function public.run_data_retention_cleanup(boolean) from public;
revoke all on function public.run_data_retention_cleanup(boolean) from anon;
revoke all on function public.run_data_retention_cleanup(boolean) from authenticated;
grant execute on function public.run_data_retention_cleanup(boolean) to service_role;
