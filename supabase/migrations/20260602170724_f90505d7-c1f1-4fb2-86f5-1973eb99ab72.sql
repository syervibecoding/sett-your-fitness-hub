-- =====================================================================
-- IA: Anamnese, Avaliação Funcional, Planos de Força/Corrida e Bundles
-- =====================================================================

-- 1) Anamnese única por aluno
CREATE TABLE public.student_anamneses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id             uuid NOT NULL,
  age                    integer,
  body_fat_percent       numeric(5,2),
  objective              text,
  activity_level         text,
  is_endurance_athlete   boolean DEFAULT false,
  training_modality      text,
  days_per_week_strength integer,
  days_per_week_cardio   integer,
  session_duration_min   integer,
  equipment              text,
  experience_months      integer,
  sport                  text,
  fcmax                  integer,
  fcrep                  integer,
  current_volume_weekly  numeric,
  cardio_goal            text,
  stress_score           integer,
  sleep_quality          integer,
  injuries               text,
  food_restrictions      text,
  budget_food            text,
  meals_per_day          integer DEFAULT 5,
  has_kitchen            boolean DEFAULT true,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_anamneses_unique UNIQUE (student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_anamneses TO authenticated;
GRANT ALL ON public.student_anamneses TO service_role;
ALTER TABLE public.student_anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company scoped select" ON public.student_anamneses
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped insert" ON public.student_anamneses
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped update" ON public.student_anamneses
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped delete" ON public.student_anamneses
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Master full access" ON public.student_anamneses
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Student reads own anamnese" ON public.student_anamneses
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_anamneses.student_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_student_anamneses_updated_at
  BEFORE UPDATE ON public.student_anamneses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Avaliação funcional
CREATE TABLE public.functional_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL,
  queixa_principal  text,
  historico_lesoes  text,
  modalidade        text,
  nivel             text,
  ai_raw_response   text,
  report_text       text,
  assessment_json   jsonb,
  status            text DEFAULT 'completed',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.functional_assessments TO authenticated;
GRANT ALL ON public.functional_assessments TO service_role;
ALTER TABLE public.functional_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company scoped select" ON public.functional_assessments
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped insert" ON public.functional_assessments
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped update" ON public.functional_assessments
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped delete" ON public.functional_assessments
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Master full access" ON public.functional_assessments
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Student reads own assessment" ON public.functional_assessments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = functional_assessments.student_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_functional_assessments_updated_at
  BEFORE UPDATE ON public.functional_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Planos de corrida/cardio gerados por IA
CREATE TABLE public.running_plans (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id             uuid NOT NULL,
  plan_name              text,
  sport                  text,
  goal                   text,
  weeks                  jsonb,
  fc_zones               jsonb,
  safety_check           jsonb,
  general_tips           text,
  warnings               text[],
  complementary_strength jsonb,
  nutrition_alert        text,
  duration_weeks         integer,
  model                  text,
  anamnese_id            uuid REFERENCES public.student_anamneses(id) ON DELETE SET NULL,
  bundle_id              uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.running_plans TO authenticated;
GRANT ALL ON public.running_plans TO service_role;
ALTER TABLE public.running_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company scoped select" ON public.running_plans
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped insert" ON public.running_plans
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped update" ON public.running_plans
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped delete" ON public.running_plans
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Master full access" ON public.running_plans
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Student reads own running plan" ON public.running_plans
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = running_plans.student_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_running_plans_updated_at
  BEFORE UPDATE ON public.running_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Planos de força gerados por IA (JSON)
CREATE TABLE public.ai_strength_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id          uuid NOT NULL,
  cycle_name          text,
  objective           text,
  duration_weeks      integer,
  biomechanical_notes text,
  plan                jsonb,
  anamnese_id         uuid REFERENCES public.student_anamneses(id) ON DELETE SET NULL,
  bundle_id           uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_strength_plans TO authenticated;
GRANT ALL ON public.ai_strength_plans TO service_role;
ALTER TABLE public.ai_strength_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company scoped select" ON public.ai_strength_plans
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped insert" ON public.ai_strength_plans
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped update" ON public.ai_strength_plans
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped delete" ON public.ai_strength_plans
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Master full access" ON public.ai_strength_plans
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Student reads own strength plan" ON public.ai_strength_plans
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = ai_strength_plans.student_id AND s.user_id = auth.uid()));

CREATE TRIGGER update_ai_strength_plans_updated_at
  BEFORE UPDATE ON public.ai_strength_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Bundle integrador
CREATE TABLE public.prescription_bundles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL,
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  anamnese_id      uuid REFERENCES public.student_anamneses(id) ON DELETE SET NULL,
  strength_plan_id uuid REFERENCES public.ai_strength_plans(id) ON DELETE SET NULL,
  running_plan_id  uuid REFERENCES public.running_plans(id) ON DELETE SET NULL,
  assessment_id    uuid REFERENCES public.functional_assessments(id) ON DELETE SET NULL,
  has_strength     boolean DEFAULT false,
  has_cardio       boolean DEFAULT false,
  status           text DEFAULT 'active',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_bundles TO authenticated;
GRANT ALL ON public.prescription_bundles TO service_role;
ALTER TABLE public.prescription_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company scoped select" ON public.prescription_bundles
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped insert" ON public.prescription_bundles
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped update" ON public.prescription_bundles
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company scoped delete" ON public.prescription_bundles
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Master full access" ON public.prescription_bundles
  FOR ALL USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Índices
CREATE INDEX idx_anamneses_student ON public.student_anamneses(student_id);
CREATE INDEX idx_anamneses_company ON public.student_anamneses(company_id);
CREATE INDEX idx_assessments_student ON public.functional_assessments(student_id);
CREATE INDEX idx_assessments_company ON public.functional_assessments(company_id);
CREATE INDEX idx_running_plans_student ON public.running_plans(student_id);
CREATE INDEX idx_running_plans_company ON public.running_plans(company_id);
CREATE INDEX idx_strength_plans_student ON public.ai_strength_plans(student_id);
CREATE INDEX idx_strength_plans_company ON public.ai_strength_plans(company_id);
CREATE INDEX idx_bundles_student ON public.prescription_bundles(student_id);
CREATE INDEX idx_bundles_company ON public.prescription_bundles(company_id);