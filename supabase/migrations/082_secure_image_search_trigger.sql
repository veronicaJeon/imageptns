-- The image FTS trigger reads service-role-only caption data while processing
-- photographer inserts. Run the trigger as its owner without granting direct
-- caption-table access to authenticated users.

alter function public.update_image_fts() security definer;
alter function public.update_image_fts() set search_path = public;

revoke all on function public.update_image_fts() from public, anon, authenticated;

comment on function public.update_image_fts() is
  'Owner-executed image search-vector trigger; keeps image_ai_captions private from authenticated users.';
