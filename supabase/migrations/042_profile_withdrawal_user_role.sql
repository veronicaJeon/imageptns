-- Allow ordinary members to request account withdrawal review from dashboard settings.

alter table public.profile_withdrawal_requests
  drop constraint if exists profile_withdrawal_requests_requester_role_check;

alter table public.profile_withdrawal_requests
  add constraint profile_withdrawal_requests_requester_role_check
    check (requester_role in ('admin', 'photographer', 'user'));
