-- Progress photos, automation trigger scans, and payment recovery events.

CREATE OR REPLACE FUNCTION public.try_uuid(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN value::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 1) Progress photos storage and metadata.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, photo_path)
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;

CREATE OR REPLACE FUNCTION public.set_progress_photo_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT s.company_id INTO NEW.company_id
    FROM public.students s
    WHERE s.id = NEW.student_id;
  END IF;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'progress photo company_id could not be resolved';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_progress_photo_company_id ON public.progress_photos;
CREATE TRIGGER trg_set_progress_photo_company_id
  BEFORE INSERT OR UPDATE OF student_id, company_id ON public.progress_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_progress_photo_company_id();

DROP TRIGGER IF EXISTS update_progress_photos_updated_at ON public.progress_photos;
CREATE TRIGGER update_progress_photos_updated_at
  BEFORE UPDATE ON public.progress_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Student manages own progress photos" ON public.progress_photos;
CREATE POLICY "Student manages own progress photos"
  ON public.progress_photos
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = progress_photos.student_id
      AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = progress_photos.student_id
      AND s.user_id = auth.uid()
      AND s.company_id = progress_photos.company_id
  ));

DROP POLICY IF EXISTS "Company scoped select progress photos" ON public.progress_photos;
CREATE POLICY "Company scoped select progress photos"
  ON public.progress_photos
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Master full access progress photos" ON public.progress_photos;
CREATE POLICY "Master full access progress photos"
  ON public.progress_photos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE INDEX IF NOT EXISTS idx_progress_photos_student_taken
  ON public.progress_photos (student_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_company_taken
  ON public.progress_photos (company_id, taken_at DESC);

DROP POLICY IF EXISTS "Students upload own progress photo objects" ON storage.objects;
CREATE POLICY "Students upload own progress photo objects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.try_uuid((storage.foldername(name))[1])
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students read own progress photo objects" ON storage.objects;
CREATE POLICY "Students read own progress photo objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.try_uuid((storage.foldername(name))[1])
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company staff reads progress photo objects" ON storage.objects;
CREATE POLICY "Company staff reads progress photo objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND EXISTS (
      SELECT 1
      FROM public.progress_photos pp
      WHERE pp.photo_path = storage.objects.name
        AND pp.company_id = public.get_user_company_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Students delete own progress photo objects" ON storage.objects;
CREATE POLICY "Students delete own progress photo objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = public.try_uuid((storage.foldername(name))[1])
        AND s.user_id = auth.uid()
    )
  );

-- 2) Payment/cart recovery event ledger.
CREATE TABLE IF NOT EXISTS public.payment_recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('plan_selected', 'payment_started', 'payment_abandoned', 'payment_completed')),
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_recovery_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.payment_recovery_events TO authenticated;
GRANT ALL ON public.payment_recovery_events TO service_role;

DROP POLICY IF EXISTS "Company scoped select payment recovery events" ON public.payment_recovery_events;
CREATE POLICY "Company scoped select payment recovery events"
  ON public.payment_recovery_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Master full access payment recovery events" ON public.payment_recovery_events;
CREATE POLICY "Master full access payment recovery events"
  ON public.payment_recovery_events
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE INDEX IF NOT EXISTS idx_payment_recovery_events_student_time
  ON public.payment_recovery_events (student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_recovery_events_company_type_time
  ON public.payment_recovery_events (company_id, event_type, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.record_payment_recovery_event(
  _student_id uuid,
  _event_type text,
  _plan_id uuid DEFAULT NULL,
  _payment_id uuid DEFAULT NULL,
  _enrollment_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _source text DEFAULT 'system'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_event_id uuid;
BEGIN
  IF _event_type NOT IN ('plan_selected', 'payment_started', 'payment_abandoned', 'payment_completed') THEN
    RAISE EXCEPTION 'invalid recovery event type: %', _event_type;
  END IF;

  SELECT s.company_id INTO v_company_id
  FROM public.students s
  WHERE s.id = _student_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'student not found for recovery event';
  END IF;

  INSERT INTO public.payment_recovery_events (
    student_id, company_id, plan_id, payment_id, enrollment_id, event_type, source, metadata
  )
  VALUES (
    _student_id, v_company_id, _plan_id, _payment_id, _enrollment_id, _event_type, _source, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_recovery_event(uuid, text, uuid, uuid, uuid, jsonb, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_student_plan_recovery_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.selected_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_payment_recovery_event(
      NEW.id,
      'plan_selected',
      NEW.selected_plan_id,
      NULL,
      NULL,
      jsonb_build_object('student_status', NEW.status),
      'students.selected_plan_id'
    );
  ELSIF NEW.selected_plan_id IS DISTINCT FROM OLD.selected_plan_id THEN
    PERFORM public.record_payment_recovery_event(
      NEW.id,
      'plan_selected',
      NEW.selected_plan_id,
      NULL,
      NULL,
      jsonb_build_object('student_status', NEW.status),
      'students.selected_plan_id'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_student_plan_recovery_event ON public.students;
CREATE TRIGGER trg_record_student_plan_recovery_event
  AFTER INSERT OR UPDATE OF selected_plan_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.record_student_plan_recovery_event();

CREATE OR REPLACE FUNCTION public.record_payment_recovery_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_type text;
  v_plan_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'payment_started';
  ELSIF COALESCE(NEW.status, '') IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
        AND COALESCE(OLD.status, '') IS DISTINCT FROM COALESCE(NEW.status, '') THEN
    v_event_type := 'payment_completed';
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.enrollment_id IS NOT NULL THEN
    SELECT e.plan_id INTO v_plan_id
    FROM public.enrollments e
    WHERE e.id = NEW.enrollment_id;
  END IF;

  PERFORM public.record_payment_recovery_event(
    NEW.student_id,
    v_event_type,
    v_plan_id,
    NEW.id,
    NEW.enrollment_id,
    jsonb_build_object(
      'status', NEW.status,
      'asaas_payment_id', NEW.asaas_payment_id,
      'billing_type', NEW.billing_type,
      'amount', COALESCE(NEW.value, NEW.amount)
    ),
    'payments'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_payment_recovery_from_payment ON public.payments;
CREATE TRIGGER trg_record_payment_recovery_from_payment
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.record_payment_recovery_from_payment();

CREATE OR REPLACE FUNCTION public.mark_payment_recovery_abandoned()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT DISTINCT ON (e.student_id) e.*
    FROM public.payment_recovery_events e
    WHERE e.event_type IN ('plan_selected', 'payment_started')
      AND e.occurred_at <= now() - interval '2 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_recovery_events done
        WHERE done.student_id = e.student_id
          AND done.event_type = 'payment_completed'
          AND done.occurred_at >= e.occurred_at
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_recovery_events abandoned
        WHERE abandoned.student_id = e.student_id
          AND abandoned.event_type = 'payment_abandoned'
          AND abandoned.occurred_at >= e.occurred_at
      )
    ORDER BY e.student_id, e.occurred_at DESC
  ),
  inserted AS (
    INSERT INTO public.payment_recovery_events (
      student_id, company_id, plan_id, payment_id, enrollment_id, event_type, source, metadata
    )
    SELECT
      c.student_id,
      c.company_id,
      c.plan_id,
      c.payment_id,
      c.enrollment_id,
      'payment_abandoned',
      'recovery_scan',
      jsonb_build_object('origin_event_id', c.id, 'origin_event_type', c.event_type)
    FROM candidates c
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payment_recovery_abandoned() TO authenticated, service_role;

-- 3) Automation trigger scan.
ALTER TABLE public.flow_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS update_flow_sessions_updated_at ON public.flow_sessions;
CREATE TRIGGER update_flow_sessions_updated_at
  BEFORE UPDATE ON public.flow_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.automation_flow_nodes ADD COLUMN IF NOT EXISTS node_type text;
UPDATE public.automation_flow_nodes
SET node_type = COALESCE(node_type, type)
WHERE node_type IS NULL;

CREATE OR REPLACE FUNCTION public.sync_automation_node_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.node_type := COALESCE(NEW.node_type, NEW.type, 'content');
  NEW.type := COALESCE(NEW.type, NEW.node_type, 'content');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_automation_node_type ON public.automation_flow_nodes;
CREATE TRIGGER trg_sync_automation_node_type
  BEFORE INSERT OR UPDATE OF type, node_type ON public.automation_flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.sync_automation_node_type();

CREATE OR REPLACE FUNCTION public.get_automation_start_node(_flow_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT n.id::text
  FROM public.automation_flow_nodes n
  WHERE n.flow_id = _flow_id
    AND COALESCE(n.node_type, n.type) = 'start'
  ORDER BY n.created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.process_automation_triggers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_no_workout integer := 0;
  v_payment_pending integer := 0;
  v_cart_recovery integer := 0;
  v_abandoned integer := 0;
BEGIN
  SELECT public.mark_payment_recovery_abandoned() INTO v_abandoned;

  WITH candidates AS (
    SELECT
      f.id AS flow_id,
      c.id AS chat_id,
      public.get_automation_start_node(f.id) AS start_node_id,
      s.id AS student_id,
      s.full_name AS student_name,
      max(COALESCE(ws.completed_at, ws.session_date::timestamptz)) AS last_completed_at
    FROM public.automation_flows f
    JOIN public.students s ON s.company_id = f.company_id
    JOIN public.whatsapp_chats c ON c.company_id = f.company_id AND c.student_id = s.id
    LEFT JOIN public.workout_sessions ws
      ON ws.student_id = s.id
      AND ws.status = 'completed'
    WHERE f.is_active = true
      AND f.trigger_type = 'no_workout_7d'
      AND COALESCE(s.status, '') IN ('active', 'awaiting_training', 'awaiting_renewal')
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.student_id = s.id
          AND e.status IN ('active', 'awaiting_training')
          AND COALESCE(e.training_start_date, e.start_date, e.created_at::date) <= CURRENT_DATE - 7
      )
    GROUP BY f.id, c.id, s.id, s.full_name
    HAVING COALESCE(max(COALESCE(ws.completed_at, ws.session_date::timestamptz)), '-infinity'::timestamptz) < now() - interval '7 days'
  ),
  inserted AS (
    INSERT INTO public.flow_sessions (
      flow_id, chat_id, current_node_id, status, context, started_at, last_activity_at, created_at, updated_at
    )
    SELECT
      c.flow_id,
      c.chat_id,
      c.start_node_id,
      'active',
      jsonb_build_object(
        'trigger_type', 'no_workout_7d',
        'automation_key', 'no_workout_7d:' || c.student_id::text,
        'student_id', c.student_id,
        'student_name', c.student_name,
        'last_completed_at', c.last_completed_at
      ),
      now(),
      now(),
      now(),
      now()
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.flow_sessions fs
      WHERE fs.flow_id = c.flow_id
        AND fs.chat_id = c.chat_id
        AND fs.status IN ('active', 'waiting_response')
        AND fs.context->>'automation_key' = 'no_workout_7d:' || c.student_id::text
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flow_sessions fs
      WHERE fs.flow_id = c.flow_id
        AND fs.chat_id = c.chat_id
        AND fs.context->>'automation_key' = 'no_workout_7d:' || c.student_id::text
        AND COALESCE(fs.updated_at, fs.created_at) > now() - interval '6 days'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_no_workout FROM inserted;

  WITH candidates AS (
    SELECT DISTINCT ON (f.id, c.id, s.id)
      f.id AS flow_id,
      c.id AS chat_id,
      public.get_automation_start_node(f.id) AS start_node_id,
      s.id AS student_id,
      s.full_name AS student_name,
      e.id AS enrollment_id,
      COALESCE(e.payment_status, 'pending') AS payment_status,
      p.id AS payment_id,
      p.status AS provider_status
    FROM public.automation_flows f
    JOIN public.students s ON s.company_id = f.company_id
    JOIN public.whatsapp_chats c ON c.company_id = f.company_id AND c.student_id = s.id
    LEFT JOIN public.enrollments e
      ON e.student_id = s.id
      AND e.status IN ('active', 'awaiting_training', 'awaiting_renewal')
    LEFT JOIN public.payments p
      ON p.student_id = s.id
      AND COALESCE(p.status, 'PENDING') NOT IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
    WHERE f.is_active = true
      AND f.trigger_type = 'payment_pending'
      AND (
        COALESCE(e.payment_status, '') IN ('pending', 'overdue')
        OR p.id IS NOT NULL
      )
    ORDER BY f.id, c.id, s.id, p.created_at DESC NULLS LAST, e.created_at DESC NULLS LAST
  ),
  inserted AS (
    INSERT INTO public.flow_sessions (
      flow_id, chat_id, current_node_id, status, context, started_at, last_activity_at, created_at, updated_at
    )
    SELECT
      c.flow_id,
      c.chat_id,
      c.start_node_id,
      'active',
      jsonb_build_object(
        'trigger_type', 'payment_pending',
        'automation_key', 'payment_pending:' || c.student_id::text || ':' || COALESCE(c.enrollment_id::text, c.payment_id::text, 'open'),
        'student_id', c.student_id,
        'student_name', c.student_name,
        'enrollment_id', c.enrollment_id,
        'payment_id', c.payment_id,
        'payment_status', c.payment_status,
        'provider_status', c.provider_status
      ),
      now(),
      now(),
      now(),
      now()
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.flow_sessions fs
      WHERE fs.flow_id = c.flow_id
        AND fs.chat_id = c.chat_id
        AND fs.status IN ('active', 'waiting_response')
        AND fs.context->>'automation_key' = 'payment_pending:' || c.student_id::text || ':' || COALESCE(c.enrollment_id::text, c.payment_id::text, 'open')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flow_sessions fs
      WHERE fs.flow_id = c.flow_id
        AND fs.chat_id = c.chat_id
        AND fs.context->>'automation_key' = 'payment_pending:' || c.student_id::text || ':' || COALESCE(c.enrollment_id::text, c.payment_id::text, 'open')
        AND COALESCE(fs.updated_at, fs.created_at) > now() - interval '1 day'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_payment_pending FROM inserted;

  WITH candidates AS (
    SELECT
      f.id AS flow_id,
      c.id AS chat_id,
      public.get_automation_start_node(f.id) AS start_node_id,
      s.id AS student_id,
      s.full_name AS student_name,
      e.id AS event_id,
      e.plan_id,
      e.payment_id,
      e.enrollment_id
    FROM public.payment_recovery_events e
    JOIN public.students s ON s.id = e.student_id
    JOIN public.automation_flows f ON f.company_id = e.company_id
    JOIN public.whatsapp_chats c ON c.company_id = e.company_id AND c.student_id = e.student_id
    WHERE e.event_type = 'payment_abandoned'
      AND f.is_active = true
      AND f.trigger_type = 'payment_pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_recovery_events done
        WHERE done.student_id = e.student_id
          AND done.event_type = 'payment_completed'
          AND done.occurred_at >= e.occurred_at
      )
  ),
  inserted AS (
    INSERT INTO public.flow_sessions (
      flow_id, chat_id, current_node_id, status, context, started_at, last_activity_at, created_at, updated_at
    )
    SELECT
      c.flow_id,
      c.chat_id,
      c.start_node_id,
      'active',
      jsonb_build_object(
        'trigger_type', 'payment_pending',
        'recovery_type', 'cart_abandoned',
        'automation_key', 'cart_abandoned:' || c.event_id::text,
        'student_id', c.student_id,
        'student_name', c.student_name,
        'recovery_event_id', c.event_id,
        'plan_id', c.plan_id,
        'payment_id', c.payment_id,
        'enrollment_id', c.enrollment_id
      ),
      now(),
      now(),
      now(),
      now()
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.flow_sessions fs
      WHERE fs.flow_id = c.flow_id
        AND fs.chat_id = c.chat_id
        AND fs.context->>'automation_key' = 'cart_abandoned:' || c.event_id::text
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_cart_recovery FROM inserted;

  RETURN jsonb_build_object(
    'no_workout_7d', v_no_workout,
    'payment_pending', v_payment_pending,
    'cart_recovery', v_cart_recovery,
    'abandoned_events_created', v_abandoned
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_automation_triggers() TO authenticated, service_role;

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

  -- 5. Open automation sessions for lifecycle triggers without sending messages directly.
  PERFORM public.process_automation_triggers();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_enrollment_lifecycle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_enrollment_lifecycle() TO service_role;

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
