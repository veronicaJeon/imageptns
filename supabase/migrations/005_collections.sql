CREATE TABLE public.collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

CREATE TABLE public.collection_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  image_id      uuid not null references public.images(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique(collection_id, image_id)
);

create index collections_user_idx on public.collections(user_id);
create index collection_items_collection_idx on public.collection_items(collection_id);

alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;

create policy "collections: self crud"
  on public.collections for all
  using (auth.uid() = user_id);

create policy "collection_items: self crud"
  on public.collection_items for all
  using (
    auth.uid() = (
      select user_id from public.collections where id = collection_id
    )
  );
