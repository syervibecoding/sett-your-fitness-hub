-- ============ student_goals (Provas e Metas) ============
CREATE TABLE public.student_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'meta',
  target_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_goals TO authenticated;
GRANT ALL ON public.student_goals TO service_role;

ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master full access student goals"
  ON public.student_goals FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Staff manage company student goals"
  ON public.student_goals FOR ALL
  USING (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role)))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role)));

CREATE POLICY "Student reads own goals"
  ON public.student_goals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_goals.student_id AND s.user_id = auth.uid()));

CREATE TRIGGER set_student_goals_company_id
  BEFORE INSERT ON public.student_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_body_limitation_company_id();

CREATE TRIGGER update_student_goals_updated_at
  BEFORE UPDATE ON public.student_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ student_documents (Pasta do Aluno, só equipe) ============
CREATE TABLE public.student_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size bigint,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_documents TO authenticated;
GRANT ALL ON public.student_documents TO service_role;

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master full access student documents"
  ON public.student_documents FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Staff manage company student documents"
  ON public.student_documents FOR ALL
  USING (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role)))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role)));

CREATE TRIGGER set_student_documents_company_id
  BEFORE INSERT ON public.student_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_body_limitation_company_id();

CREATE TRIGGER update_student_documents_updated_at
  BEFORE UPDATE ON public.student_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();