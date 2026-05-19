-- IMAGE PARTNERS - tighten image storage upload policies

drop policy if exists "images-original: photographer upload" on storage.objects;

create policy "images-original: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'images-original'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "images-full: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'images-full'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "images-preview: service-managed upload"
  on storage.objects for insert
  with check (
    bucket_id = 'images-preview'
    and auth.role() = 'service_role'
  );
