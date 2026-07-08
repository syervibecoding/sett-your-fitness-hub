ALTER TABLE public.student_anamneses
  ADD COLUMN IF NOT EXISTS prescribed_modalities text[] NOT NULL DEFAULT '{}';