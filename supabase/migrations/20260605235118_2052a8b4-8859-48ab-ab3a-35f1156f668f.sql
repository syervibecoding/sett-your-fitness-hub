CREATE TABLE public.body_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  company_id uuid NOT NULL,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  neck numeric,
  shoulder numeric,
  chest numeric,
  waist numeric,
  abdomen numeric,
  hip numeric,
  arm numeric,
  forearm numeric,
  thigh numeric,
  calf numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
GRANT ALL ON public.body_measurements TO service_role;

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- Student manages their own measurements
CREATE POLICY "Student manages own measurements"
  ON public.body_measurements
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = body_measurements.student_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = body_measurements.student_id AND s.user_id = auth.uid()));

-- Company staff can view
CREATE POLICY "Company scoped select measurements"
  ON public.body_measurements
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Master full access
CREATE POLICY "Master full access measurements"
  ON public.body_measurements
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER update_body_measurements_updated_at
  BEFORE UPDATE ON public.body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_body_measurements_student ON public.body_measurements (student_id, measured_at DESC);