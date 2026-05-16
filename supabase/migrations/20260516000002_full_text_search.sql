ALTER TABLE public.images
  ADD COLUMN search_vector TSVECTOR
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        COALESCE(title, '') || ' ' ||
        COALESCE(caption, '') || ' ' ||
        COALESCE(location_name, '')
      )
    ) STORED;

CREATE INDEX idx_images_search ON public.images USING GIN (search_vector);
CREATE INDEX idx_images_uploader ON public.images (uploader_id);
CREATE INDEX idx_images_published ON public.images (is_published, created_at DESC);
