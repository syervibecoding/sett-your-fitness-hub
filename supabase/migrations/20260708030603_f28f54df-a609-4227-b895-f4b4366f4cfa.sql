ALTER TABLE public.exercise_library ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

UPDATE public.exercise_library
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND (categories IS NULL OR categories = '{}');