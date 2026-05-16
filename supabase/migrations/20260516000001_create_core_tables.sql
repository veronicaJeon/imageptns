-- categories
CREATE TABLE public.categories (
  id      SMALLSERIAL PRIMARY KEY,
  slug    TEXT UNIQUE NOT NULL,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL
);

-- profiles (extends auth.users 1-to-1)
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name TEXT,
  bio          TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- images
CREATE TABLE public.images (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  title         TEXT NOT NULL,
  caption       TEXT,
  location_name TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  taken_at      TIMESTAMPTZ,
  width         INT,
  height        INT,
  file_size     BIGINT,
  mime_type     TEXT,
  is_published  BOOLEAN DEFAULT TRUE NOT NULL,
  download_count INT DEFAULT 0 NOT NULL,
  view_count     INT DEFAULT 0 NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- tags
CREATE TABLE public.tags (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- image_tags junction
CREATE TABLE public.image_tags (
  image_id UUID REFERENCES public.images(id) ON DELETE CASCADE,
  tag_id   INT  REFERENCES public.tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (image_id, tag_id)
);

-- image_categories junction
CREATE TABLE public.image_categories (
  image_id    UUID     REFERENCES public.images(id)      ON DELETE CASCADE,
  category_id SMALLINT REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (image_id, category_id)
);

-- search_logs (analytics)
CREATE TABLE public.search_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query        TEXT NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result_count INT  DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
