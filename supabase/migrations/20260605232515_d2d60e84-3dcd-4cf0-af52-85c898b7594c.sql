CREATE OR REPLACE FUNCTION public.process_enrollment_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Advance training cycles (reuse existing logic)
  PERFORM public.advance_training_cycles();

  -- 2. Mark active enrollments as awaiting_renewal when contract ended OR last training cycle ended
  UPDATE public.enrollments e
     SET status = 'awaiting_renewal', updated_at = now()
   WHERE e.status = 'active'
     AND (
       (e.end_date IS NOT NULL AND e.end_date < CURRENT_DATE)
       OR (
         e.training_start_date IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.training_cycles tc WHERE tc.enrollment_id = e.id)
         AND NOT EXISTS (SELECT 1 FROM public.training_cycles tc WHERE tc.enrollment_id = e.id AND tc.status IN ('active','pending'))
         AND (SELECT max(tc.end_date) FROM public.training_cycles tc WHERE tc.enrollment_id = e.id) < CURRENT_DATE
       )
     );

  -- 3a. Student becomes awaiting_renewal when no active/awaiting_training enrollment but has an awaiting_renewal one
  UPDATE public.students s
     SET status = 'awaiting_renewal', updated_at = now()
   WHERE s.status NOT IN ('inactive','awaiting_renewal')
     AND NOT EXISTS (
       SELECT 1 FROM public.enrollments e
        WHERE e.student_id = s.id AND e.status IN ('active','awaiting_training')
     )
     AND EXISTS (
       SELECT 1 FROM public.enrollments e
        WHERE e.student_id = s.id AND e.status = 'awaiting_renewal'
     );

  -- 3b. Bring students back to active when they have a fresh active/awaiting_training enrollment
  UPDATE public.students s
     SET status = 'active', updated_at = now()
   WHERE s.status = 'awaiting_renewal'
     AND EXISTS (
       SELECT 1 FROM public.enrollments e
        WHERE e.student_id = s.id AND e.status IN ('active','awaiting_training')
     );

  -- 4a. Auto inadimplência on payments: past due and not paid -> OVERDUE
  UPDATE public.payments p
     SET status = 'OVERDUE', updated_at = now()
   WHERE p.due_date IS NOT NULL
     AND p.due_date < CURRENT_DATE
     AND COALESCE(p.status,'PENDING') NOT IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH','OVERDUE');

  -- 4b. Reflect overdue onto enrollment.payment_status
  UPDATE public.enrollments e
     SET payment_status = 'overdue', updated_at = now()
   WHERE COALESCE(e.payment_status,'pending') <> 'paid'
     AND COALESCE(e.payment_status,'pending') <> 'overdue'
     AND EXISTS (
       SELECT 1 FROM public.payments p
        WHERE p.enrollment_id = e.id AND p.status = 'OVERDUE'
     );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_enrollment_lifecycle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_enrollment_lifecycle() TO service_role;

-- Schedule daily run
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-enrollment-lifecycle-daily') THEN
    PERFORM cron.unschedule('process-enrollment-lifecycle-daily');
  END IF;
  PERFORM cron.schedule(
    'process-enrollment-lifecycle-daily',
    '0 5 * * *',
    'SELECT public.process_enrollment_lifecycle();'
  );
END;
$cron$;