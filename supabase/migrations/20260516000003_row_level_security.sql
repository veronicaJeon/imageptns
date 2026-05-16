-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can read, only owner can update
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- images: published images viewable by all, owner can CRUD
CREATE POLICY "Published images are viewable by everyone"
  ON public.images FOR SELECT USING (is_published = true OR auth.uid() = uploader_id);
CREATE POLICY "Authenticated users can upload images"
  ON public.images FOR INSERT WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Owners can update their images"
  ON public.images FOR UPDATE USING (auth.uid() = uploader_id);
CREATE POLICY "Owners can delete their images"
  ON public.images FOR DELETE USING (auth.uid() = uploader_id);

-- tags: public read, authenticated insert
CREATE POLICY "Tags are viewable by everyone" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tags"
  ON public.tags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- image_tags: public read, owner of image can manage
CREATE POLICY "Image tags are public" ON public.image_tags FOR SELECT USING (true);
CREATE POLICY "Image owner can add tags"
  ON public.image_tags FOR INSERT WITH CHECK (
    auth.uid() = (SELECT uploader_id FROM public.images WHERE id = image_id)
  );
CREATE POLICY "Image owner can remove tags"
  ON public.image_tags FOR DELETE USING (
    auth.uid() = (SELECT uploader_id FROM public.images WHERE id = image_id)
  );

-- image_categories: same pattern
CREATE POLICY "Image categories are public" ON public.image_categories FOR SELECT USING (true);
CREATE POLICY "Image owner can manage categories"
  ON public.image_categories FOR INSERT WITH CHECK (
    auth.uid() = (SELECT uploader_id FROM public.images WHERE id = image_id)
  );

-- search_logs: users can only see their own, insert for all
CREATE POLICY "Users can log searches"
  ON public.search_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own logs"
  ON public.search_logs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
