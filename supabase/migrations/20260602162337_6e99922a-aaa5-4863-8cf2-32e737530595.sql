-- 1. Resolve build_workout alerts automatically when a workout is created
CREATE OR REPLACE FUNCTION public.resolve_build_workout_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
  v_student_id uuid;
BEGIN
  -- Find the enrollment + student tied to this workout's cycle
  SELECT tc.enrollment_id, e.student_id
    INTO v_enrollment_id, v_student_id
  FROM public.training_cycles tc
  JOIN public.enrollments e ON e.id = tc.enrollment_id
  WHERE tc.id = NEW.cycle_id;

  IF v_enrollment_id IS NOT NULL THEN
    UPDATE public.admin_alerts
       SET resolved_at = now()
     WHERE type = 'build_workout'
       AND resolved_at IS NULL
       AND (enrollment_id = v_enrollment_id OR student_id = v_student_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_build_workout_alert ON public.workouts;
CREATE TRIGGER trg_resolve_build_workout_alert
AFTER INSERT ON public.workouts
FOR EACH ROW EXECUTE FUNCTION public.resolve_build_workout_alert();

-- 2. Resolve assign_trainer alerts when a trainer is set directly on the student
CREATE OR REPLACE FUNCTION public.resolve_assign_trainer_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_trainer_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.assigned_trainer_id::text,'') IS DISTINCT FROM NEW.assigned_trainer_id::text) THEN
    UPDATE public.admin_alerts
       SET resolved_at = now()
     WHERE type = 'assign_trainer'
       AND resolved_at IS NULL
       AND student_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_assign_trainer_alert ON public.students;
CREATE TRIGGER trg_resolve_assign_trainer_alert
AFTER INSERT OR UPDATE OF assigned_trainer_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.resolve_assign_trainer_alert();

-- 3. Backfill: resolve stale build_workout alerts where a workout already exists
UPDATE public.admin_alerts a
   SET resolved_at = now()
 WHERE a.type = 'build_workout'
   AND a.resolved_at IS NULL
   AND EXISTS (
     SELECT 1
     FROM public.training_cycles tc
     JOIN public.workouts w ON w.cycle_id = tc.id
     WHERE tc.enrollment_id = a.enrollment_id
   );

-- 4. Backfill: resolve stale assign_trainer alerts where the student already has a trainer
UPDATE public.admin_alerts a
   SET resolved_at = now()
 WHERE a.type = 'assign_trainer'
   AND a.resolved_at IS NULL
   AND (
     EXISTS (SELECT 1 FROM public.students s WHERE s.id = a.student_id AND s.assigned_trainer_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = a.enrollment_id AND e.trainer_id IS NOT NULL)
   );