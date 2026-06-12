-- Integrated Studio ported from the BN standalone webapp.

ALTER TABLE public.student_anamneses
  ADD COLUMN IF NOT EXISTS nutrition_context text;

ALTER TABLE public.functional_assessments
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

ALTER TABLE public.prescription_bundles
  ADD COLUMN IF NOT EXISTS modalities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_swimming boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_cycling boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_nutrition boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.anamnese_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  student_name text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnese_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnese_invites TO authenticated;
GRANT ALL ON public.anamnese_invites TO service_role;

DROP POLICY IF EXISTS "anamnese_invites company select" ON public.anamnese_invites;
DROP POLICY IF EXISTS "anamnese_invites company insert" ON public.anamnese_invites;
DROP POLICY IF EXISTS "anamnese_invites company update" ON public.anamnese_invites;
DROP POLICY IF EXISTS "anamnese_invites company delete" ON public.anamnese_invites;
DROP POLICY IF EXISTS "anamnese_invites master full access" ON public.anamnese_invites;

CREATE POLICY "anamnese_invites company select" ON public.anamnese_invites
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "anamnese_invites company insert" ON public.anamnese_invites
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "anamnese_invites company update" ON public.anamnese_invites
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "anamnese_invites company delete" ON public.anamnese_invites
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "anamnese_invites master full access" ON public.anamnese_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TABLE IF NOT EXISTS public.assessment_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.functional_assessments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  frame_index integer NOT NULL,
  vista text,
  image_url text,
  ai_findings jsonb,
  trainer_findings jsonb,
  edited boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assessment_frames ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_frames TO authenticated;
GRANT ALL ON public.assessment_frames TO service_role;

DROP POLICY IF EXISTS "assessment_frames company select" ON public.assessment_frames;
DROP POLICY IF EXISTS "assessment_frames company insert" ON public.assessment_frames;
DROP POLICY IF EXISTS "assessment_frames company update" ON public.assessment_frames;
DROP POLICY IF EXISTS "assessment_frames company delete" ON public.assessment_frames;
DROP POLICY IF EXISTS "assessment_frames master full access" ON public.assessment_frames;

CREATE POLICY "assessment_frames company select" ON public.assessment_frames
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "assessment_frames company insert" ON public.assessment_frames
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "assessment_frames company update" ON public.assessment_frames
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "assessment_frames company delete" ON public.assessment_frames
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "assessment_frames master full access" ON public.assessment_frames
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  plan_name text,
  objective text,
  total_calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  energy_summary jsonb,
  carb_cycling jsonb,
  nutrition_tips jsonb,
  supplementation jsonb,
  substitutions jsonb,
  pre_race_gi_protocol text,
  intra_workout_protocol text,
  rest_day_adjustments text,
  general_notes text,
  warnings text[],
  plan jsonb,
  observations text,
  anamnese_id uuid REFERENCES public.student_anamneses(id) ON DELETE SET NULL,
  bundle_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plans TO authenticated;
GRANT ALL ON public.nutrition_plans TO service_role;

DROP POLICY IF EXISTS "nutrition_plans company select" ON public.nutrition_plans;
DROP POLICY IF EXISTS "nutrition_plans company insert" ON public.nutrition_plans;
DROP POLICY IF EXISTS "nutrition_plans company update" ON public.nutrition_plans;
DROP POLICY IF EXISTS "nutrition_plans company delete" ON public.nutrition_plans;
DROP POLICY IF EXISTS "nutrition_plans master full access" ON public.nutrition_plans;
DROP POLICY IF EXISTS "nutrition_plans student reads own" ON public.nutrition_plans;

CREATE POLICY "nutrition_plans company select" ON public.nutrition_plans
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "nutrition_plans company insert" ON public.nutrition_plans
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "nutrition_plans company update" ON public.nutrition_plans
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "nutrition_plans company delete" ON public.nutrition_plans
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "nutrition_plans master full access" ON public.nutrition_plans
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "nutrition_plans student reads own" ON public.nutrition_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = nutrition_plans.student_id
      AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_anamnese_invites_token ON public.anamnese_invites(token);
CREATE INDEX IF NOT EXISTS idx_anamnese_invites_student ON public.anamnese_invites(student_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_invites_company ON public.anamnese_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_assessment_frames_assessment ON public.assessment_frames(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_frames_company ON public.assessment_frames(company_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_student ON public.nutrition_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_company ON public.nutrition_plans(company_id);

DROP TRIGGER IF EXISTS update_nutrition_plans_updated_at ON public.nutrition_plans;
CREATE TRIGGER update_nutrition_plans_updated_at
  BEFORE UPDATE ON public.nutrition_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-frames', 'assessment-frames', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "assessment-frames company read" ON storage.objects;
DROP POLICY IF EXISTS "assessment-frames company insert" ON storage.objects;
DROP POLICY IF EXISTS "assessment-frames company update" ON storage.objects;
DROP POLICY IF EXISTS "assessment-frames company delete" ON storage.objects;

CREATE POLICY "assessment-frames company read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'assessment-frames'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
  )
);

CREATE POLICY "assessment-frames company insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assessment-frames'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
  )
);

CREATE POLICY "assessment-frames company update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'assessment-frames'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
  )
)
WITH CHECK (
  bucket_id = 'assessment-frames'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
  )
);

CREATE POLICY "assessment-frames company delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'assessment-frames'
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
  )
);
