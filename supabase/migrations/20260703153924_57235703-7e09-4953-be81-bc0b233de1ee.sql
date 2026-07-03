-- Add source column to functional_assessments to distinguish video vs photo assessments
ALTER TABLE public.functional_assessments ADD COLUMN IF NOT EXISTS source text;

-- assessment_frames: stores extracted video frames + manual trainer findings
CREATE TABLE IF NOT EXISTS public.assessment_frames (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES public.functional_assessments(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL,
  frame_index       integer NOT NULL,
  vista             text NOT NULL,
  image_url         text NOT NULL,
  ai_findings       jsonb,
  trainer_findings  jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_frames TO authenticated;
GRANT ALL ON public.assessment_frames TO service_role;
ALTER TABLE public.assessment_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company scoped select" ON public.assessment_frames
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped insert" ON public.assessment_frames
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped update" ON public.assessment_frames
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped delete" ON public.assessment_frames
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Master full access" ON public.assessment_frames
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Student reads own frames" ON public.assessment_frames
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.functional_assessments fa
    JOIN public.students s ON s.id = fa.student_id
    WHERE fa.id = assessment_frames.assessment_id AND s.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_assessment_frames_assessment ON public.assessment_frames(assessment_id);

-- Storage policies for the private assessment-frames bucket
CREATE POLICY "Staff manage assessment frames"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'assessment-frames')
  WITH CHECK (bucket_id = 'assessment-frames');