-- ============================================================
-- IMAGE PARTNERS — Migration 003: EXIF + AI Metadata
-- ============================================================

-- Add EXIF + AI metadata columns to images
ALTER TABLE public.images
  ADD COLUMN IF NOT EXISTS exif_taken_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exif_lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS exif_lng         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS exif_location    TEXT,         -- reverse geocoded place name (optional future use)
  ADD COLUMN IF NOT EXISTS exif_camera      TEXT,         -- e.g. "Canon EOS R5"
  ADD COLUMN IF NOT EXISTS ai_analyzed      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at   TIMESTAMPTZ;

-- FTS trigger check:
-- The existing update_image_fts trigger (defined in 001_initial_schema.sql) already
-- includes description via coalesce(new.description, '') — no update required.
-- Full vector: title || ' ' || description || ' ' || category || ' ' || tags
