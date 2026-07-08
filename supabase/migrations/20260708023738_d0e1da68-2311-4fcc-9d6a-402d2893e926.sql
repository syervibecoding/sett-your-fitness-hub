CREATE POLICY "Staff read company student documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-documents'
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'master'::app_role))
  );

CREATE POLICY "Staff insert company student documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'master'::app_role))
  );

CREATE POLICY "Staff update company student documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-documents'
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'master'::app_role))
  );

CREATE POLICY "Staff delete company student documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-documents'
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'coordinator'::app_role) OR has_role(auth.uid(),'trainer'::app_role) OR has_role(auth.uid(),'master'::app_role))
  );