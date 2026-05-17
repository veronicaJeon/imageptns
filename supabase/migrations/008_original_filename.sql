-- Add original_filename column to images table
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS original_filename text;
