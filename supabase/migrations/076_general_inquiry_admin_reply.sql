-- IMAGE PARTNERS - Record the operator's answer to a general inquiry
-- The answer is emailed to the customer from the admin support page and kept
-- here so the reply sent is visible to every operator.

alter table public.contact_submissions
  add column if not exists admin_reply text,
  add column if not exists admin_replied_at timestamptz,
  add column if not exists admin_replied_by uuid references public.profiles(id) on delete set null;

alter table public.contact_submissions
  drop constraint if exists contact_submissions_admin_reply_length_check;

alter table public.contact_submissions
  add constraint contact_submissions_admin_reply_length_check
    check (admin_reply is null or char_length(admin_reply) <= 5000);
