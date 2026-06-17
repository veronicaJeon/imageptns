-- IMAGE PARTNERS - Simplified buyer-facing sourcing request intake

alter table public.profiles
  add column if not exists organization text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, organization)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'buyer'),
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization', '')), '')
  );
  return new;
end;
$$;

alter table public.contact_submissions
  add column if not exists requester_organization text,
  add column if not exists usage_project text,
  add column if not exists usage_context text;

alter table public.contact_submissions
  drop constraint if exists contact_submissions_photo_field_length_check,
  drop constraint if exists contact_submissions_photo_required_check,
  drop constraint if exists contact_submissions_sourcing_purposes_check;

alter table public.contact_submissions
  add constraint contact_submissions_photo_field_length_check
    check (
      (location_label is null or char_length(location_label) <= 160)
      and (category is null or char_length(category) <= 80)
      and (usage_intent is null or char_length(usage_intent) <= 500)
      and (license_intent is null or char_length(license_intent) <= 240)
      and (reference_url is null or char_length(reference_url) <= 2048)
      and (reference_note is null or char_length(reference_note) <= 1000)
      and (requester_organization is null or char_length(requester_organization) <= 160)
      and (usage_project is null or char_length(usage_project) <= 240)
      and (usage_context is null or char_length(usage_context) <= 1000)
    ),
  add constraint contact_submissions_photo_required_check
    check (
      inquiry_type <> 'photo_request'
      or (
        requester_organization is not null
        and char_length(requester_organization) > 0
        and usage_project is not null
        and char_length(usage_project) > 0
        and usage_context is not null
        and char_length(usage_context) > 0
        and deadline_at is not null
      )
    ),
  add constraint contact_submissions_sourcing_purposes_check
    check (
      sourcing_purposes <@ array[
        'rights_check',
        'similar_search',
        'supply_check',
        'context_reference',
        'shooting_request'
      ]::text[]
      and cardinality(sourcing_purposes) <= 5
    );
