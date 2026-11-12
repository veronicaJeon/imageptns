-- Keep pre-validation photo requests logically restorable without weakening
-- the required requester details for requests created after the rule shipped.

alter table public.contact_submissions
  drop constraint if exists contact_submissions_photo_required_check;

alter table public.contact_submissions
  add constraint contact_submissions_photo_required_check
    check (
      inquiry_type <> 'photo_request'
      or created_at < timestamptz '2026-07-16 13:17:17+00'
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

comment on constraint contact_submissions_photo_required_check on public.contact_submissions is
  'Requires complete requester details for photo requests created after the rule shipped; preserves pre-rule rows for logical disaster recovery.';
