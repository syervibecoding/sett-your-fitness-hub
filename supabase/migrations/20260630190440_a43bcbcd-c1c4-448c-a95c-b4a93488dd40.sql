-- Allow students to read their own anamnesis records
CREATE POLICY "Students can read own anamnesis"
ON public.anamnesis
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = anamnesis.student_id
      AND s.user_id = auth.uid()
  )
);

-- Allow students to read their own payment records
CREATE POLICY "Students can read own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = payments.student_id
      AND s.user_id = auth.uid()
  )
);

-- Allow students to read their own training cycles
CREATE POLICY "Students can read own training cycles"
ON public.training_cycles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.id = training_cycles.enrollment_id
      AND s.user_id = auth.uid()
  )
);