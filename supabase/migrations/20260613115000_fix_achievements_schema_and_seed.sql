-- Corrective gamification schema for projects where the original May migration
-- was not applied but the student app already references achievements.

CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  icon text DEFAULT 'trophy',
  xp_reward integer NOT NULL DEFAULT 50,
  criteria_type text NOT NULL,
  criteria_value integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_company_code
  ON public.achievements (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
CREATE INDEX IF NOT EXISTS idx_achievements_company_active
  ON public.achievements (company_id, is_active, criteria_type, criteria_value);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read achievements" ON public.achievements;
CREATE POLICY "Read achievements" ON public.achievements
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Admin company insert achievements" ON public.achievements;
CREATE POLICY "Admin company insert achievements" ON public.achievements
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordinator'::app_role))
  );

DROP POLICY IF EXISTS "Admin company update achievements" ON public.achievements;
CREATE POLICY "Admin company update achievements" ON public.achievements
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordinator'::app_role))
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordinator'::app_role))
  );

DROP POLICY IF EXISTS "Admin company delete achievements" ON public.achievements;
CREATE POLICY "Admin company delete achievements" ON public.achievements
  FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordinator'::app_role))
  );

DROP POLICY IF EXISTS "Master full access achievements" ON public.achievements;
CREATE POLICY "Master full access achievements" ON public.achievements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

DROP TRIGGER IF EXISTS update_achievements_updated_at ON public.achievements;
CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON public.student_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_student_achievements_company ON public.student_achievements(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_achievements TO authenticated;
GRANT ALL ON public.student_achievements TO service_role;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student reads own achievements" ON public.student_achievements;
CREATE POLICY "Student reads own achievements" ON public.student_achievements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_achievements.student_id
      AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company scoped select achievements" ON public.student_achievements;
CREATE POLICY "Company scoped select achievements" ON public.student_achievements
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Master full access student_achievements" ON public.student_achievements;
CREATE POLICY "Master full access student_achievements" ON public.student_achievements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  xp_amount integer NOT NULL,
  source_id uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_student ON public.xp_events(student_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_company ON public.xp_events(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_events_unique_source
  ON public.xp_events(student_id, event_type, source_id)
  WHERE source_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student reads own xp" ON public.xp_events;
CREATE POLICY "Student reads own xp" ON public.xp_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = xp_events.student_id
      AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Company scoped select xp" ON public.xp_events;
CREATE POLICY "Company scoped select xp" ON public.xp_events
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Master full access xp_events" ON public.xp_events;
CREATE POLICY "Master full access xp_events" ON public.xp_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE OR REPLACE FUNCTION public.award_xp(
  _student_id uuid,
  _event_type text,
  _xp_amount integer,
  _source_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_id uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.students WHERE id = _student_id;
  IF v_company IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.xp_events (student_id, company_id, event_type, xp_amount, source_id, notes)
  VALUES (_student_id, v_company, _event_type, _xp_amount, _source_id, _notes)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(uuid, text, integer, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_and_unlock_achievements(_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_workouts integer;
  v_externals integer;
  v_cycles integer;
  v_unlocked integer := 0;
  a record;
  v_meets boolean;
  v_new_id uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.students WHERE id = _student_id;
  IF v_company IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_workouts
  FROM public.workout_sessions
  WHERE student_id = _student_id AND status = 'completed';

  SELECT count(*) INTO v_externals
  FROM public.external_activities
  WHERE student_id = _student_id;

  SELECT count(*) INTO v_cycles
  FROM public.training_cycles tc
  JOIN public.enrollments e ON e.id = tc.enrollment_id
  WHERE e.student_id = _student_id AND tc.status = 'completed';

  FOR a IN
    SELECT *
    FROM public.achievements
    WHERE is_active = true
      AND (company_id IS NULL OR company_id = v_company)
      AND NOT EXISTS (
        SELECT 1
        FROM public.student_achievements sa
        WHERE sa.student_id = _student_id
          AND sa.achievement_id = achievements.id
      )
  LOOP
    v_meets := false;
    IF a.criteria_type = 'workouts_total' AND v_workouts >= a.criteria_value THEN
      v_meets := true;
    ELSIF a.criteria_type = 'external_total' AND v_externals >= a.criteria_value THEN
      v_meets := true;
    ELSIF a.criteria_type = 'cycles_completed' AND v_cycles >= a.criteria_value THEN
      v_meets := true;
    END IF;

    IF v_meets THEN
      INSERT INTO public.student_achievements (student_id, company_id, achievement_id)
      VALUES (_student_id, v_company, a.id)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_new_id;

      IF v_new_id IS NOT NULL THEN
        PERFORM public.award_xp(_student_id, 'achievement', a.xp_reward, a.id, a.title);
        v_unlocked := v_unlocked + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_unlocked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_unlock_achievements(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_student_rank(_student_id uuid)
RETURNS TABLE (rank_position bigint, total_students bigint, xp bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company uuid;
  v_xp bigint;
BEGIN
  SELECT company_id INTO v_company FROM public.students WHERE id = _student_id;
  IF v_company IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(sum(xp_amount), 0) INTO v_xp
  FROM public.xp_events
  WHERE student_id = _student_id;

  RETURN QUERY
  WITH totals AS (
    SELECT s.id AS sid, COALESCE(sum(x.xp_amount), 0) AS total_xp
    FROM public.students s
    LEFT JOIN public.xp_events x ON x.student_id = s.id
    WHERE s.company_id = v_company
    GROUP BY s.id
  )
  SELECT
    (SELECT count(*) + 1 FROM totals t WHERE t.total_xp > v_xp)::bigint,
    (SELECT count(*) FROM totals)::bigint,
    v_xp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_rank(uuid) TO authenticated, service_role;

INSERT INTO public.achievements (company_id, code, title, description, icon, xp_reward, criteria_type, criteria_value)
VALUES
  (NULL, 'first_workout', 'Primeiro treino', 'Concluiu o primeiro treino na plataforma.', 'flame', 25, 'workouts_total', 1),
  (NULL, 'workouts_10', '10 treinos', 'Concluiu 10 treinos.', 'dumbbell', 75, 'workouts_total', 10),
  (NULL, 'workouts_50', '50 treinos', 'Cinquenta sessões registradas.', 'medal', 250, 'workouts_total', 50),
  (NULL, 'workouts_100', '100 treinos', 'Marca dos 100 treinos.', 'trophy', 500, 'workouts_total', 100),
  (NULL, 'first_external', 'Saiu da musculação', 'Registrou a primeira atividade externa.', 'bike', 25, 'external_total', 1),
  (NULL, 'external_20', '20 atividades externas', 'Vinte atividades fora da musculação.', 'route', 150, 'external_total', 20),
  (NULL, 'cycle_done', 'Ciclo completo', 'Fechou o primeiro ciclo de treino.', 'check-circle', 200, 'cycles_completed', 1),
  (NULL, 'cycle_4', '4 ciclos completos', 'Consistência: quatro ciclos fechados.', 'crown', 600, 'cycles_completed', 4)
ON CONFLICT (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), code) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    xp_reward = EXCLUDED.xp_reward,
    criteria_type = EXCLUDED.criteria_type,
    criteria_value = EXCLUDED.criteria_value,
    is_active = true,
    updated_at = now();
