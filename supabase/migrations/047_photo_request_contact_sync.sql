-- IMAGE PARTNERS - Buyer contact sync and photo request requester details

alter table public.contact_submissions
  add column if not exists requester_phone text;

alter table public.contact_submissions
  drop constraint if exists contact_submissions_requester_phone_length_check,
  drop constraint if exists contact_submissions_photo_required_check;

alter table public.contact_submissions
  add constraint contact_submissions_requester_phone_length_check
    check (requester_phone is null or char_length(requester_phone) <= 32),
  add constraint contact_submissions_photo_required_check
    check (
      inquiry_type <> 'photo_request'
      or (
        usage_project is not null
        and char_length(usage_project) > 0
        and usage_context is not null
        and char_length(usage_context) > 0
        and deadline_at is not null
      )
    );
