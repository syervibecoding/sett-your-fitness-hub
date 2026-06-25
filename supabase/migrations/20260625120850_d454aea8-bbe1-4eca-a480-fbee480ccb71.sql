-- 1. prescription_bundles: allow students to read their own bundles
CREATE POLICY "Student reads own bundles"
ON public.prescription_bundles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = prescription_bundles.student_id
      AND s.user_id = auth.uid()
  )
);

-- 2. students: prevent privilege escalation on self-update
CREATE OR REPLACE FUNCTION public.student_self_update_allowed(
  _id uuid,
  _company_id uuid,
  _status text,
  _assigned_trainer_id uuid,
  _category_id uuid,
  _asaas_customer_id text,
  _selected_plan_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _id
      AND s.user_id = auth.uid()
      AND s.company_id IS NOT DISTINCT FROM _company_id
      AND s.status IS NOT DISTINCT FROM _status
      AND s.assigned_trainer_id IS NOT DISTINCT FROM _assigned_trainer_id
      AND s.category_id IS NOT DISTINCT FROM _category_id
      AND s.asaas_customer_id IS NOT DISTINCT FROM _asaas_customer_id
      AND s.selected_plan_id IS NOT DISTINCT FROM _selected_plan_id
  )
$$;

DROP POLICY IF EXISTS "Student updates own weekly goal" ON public.students;

CREATE POLICY "Student updates own weekly goal"
ON public.students
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND public.student_self_update_allowed(
    id,
    company_id,
    status,
    assigned_trainer_id,
    category_id,
    asaas_customer_id,
    selected_plan_id
  )
);

-- 3. workout_sessions: validate company_id on student insert
DROP POLICY IF EXISTS "Student inserts own sessions" ON public.workout_sessions;

CREATE POLICY "Student inserts own sessions"
ON public.workout_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = workout_sessions.student_id
      AND s.user_id = auth.uid()
      AND s.company_id = workout_sessions.company_id
  )
);