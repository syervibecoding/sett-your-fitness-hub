-- Fase D3: Módulo de Nutrição — planos alimentares por tenant
CREATE TABLE public.nutrition_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid,
  title text NOT NULL DEFAULT 'Plano Alimentar',
  objective text NOT NULL DEFAULT 'hipertrofia',
  status text NOT NULL DEFAULT 'active',
  total_calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  water_ml integer,
  meals jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plans TO authenticated;
GRANT ALL ON public.nutrition_plans TO service_role;

ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;

-- Master tem acesso total
CREATE POLICY "Master full access"
  ON public.nutrition_plans FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Equipe da empresa (admin/coordinator/trainer): leitura/escrita escopadas por empresa
CREATE POLICY "Company scoped select"
  ON public.nutrition_plans FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company scoped insert"
  ON public.nutrition_plans FOR INSERT
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company scoped update"
  ON public.nutrition_plans FOR UPDATE
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company scoped delete"
  ON public.nutrition_plans FOR DELETE
  USING (company_id = get_user_company_id(auth.uid()));

-- Aluno lê o próprio plano
CREATE POLICY "Student reads own nutrition plan"
  ON public.nutrition_plans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = nutrition_plans.student_id AND s.user_id = auth.uid()
  ));

-- updated_at automático
CREATE TRIGGER update_nutrition_plans_updated_at
  BEFORE UPDATE ON public.nutrition_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();