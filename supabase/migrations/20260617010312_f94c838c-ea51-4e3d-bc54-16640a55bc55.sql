-- Body limitations marked by trainers/staff on the anatomical body map
CREATE TABLE public.student_body_limitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid,
  region text NOT NULL,
  type text NOT NULL DEFAULT 'muscular',
  severity text NOT NULL DEFAULT 'leve',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_body_limitations_type_check CHECK (type IN ('muscular','articular','neural')),
  CONSTRAINT student_body_limitations_severity_check CHECK (severity IN ('leve','moderada','severa')),
  CONSTRAINT student_body_limitations_unique UNIQUE (student_id, region)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_body_limitations TO authenticated;
GRANT ALL ON public.student_body_limitations TO service_role;

ALTER TABLE public.student_body_limitations ENABLE ROW LEVEL SECURITY;

-- Master has full access
CREATE POLICY "Master full access body limitations"
  ON public.student_body_limitations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Staff (admin/coordinator/trainer) within the same company manage limitations
CREATE POLICY "Staff manage company body limitations"
  ON public.student_body_limitations FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coordinator')
      OR public.has_role(auth.uid(), 'trainer')
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coordinator')
      OR public.has_role(auth.uid(), 'trainer')
    )
  );

-- Student can read their own limitations
CREATE POLICY "Student reads own body limitations"
  ON public.student_body_limitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_body_limitations.student_id
        AND s.user_id = auth.uid()
    )
  );

-- Auto-fill company_id from the student when not provided
CREATE OR REPLACE FUNCTION public.set_body_limitation_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.students WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_body_limitation_company_id_trigger
  BEFORE INSERT ON public.student_body_limitations
  FOR EACH ROW EXECUTE FUNCTION public.set_body_limitation_company_id();

CREATE TRIGGER update_student_body_limitations_updated_at
  BEFORE UPDATE ON public.student_body_limitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();