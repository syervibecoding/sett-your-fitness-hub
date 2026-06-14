-- Boneco multi-sistema: permite o 4º tipo 'organic' (cardiorrespiratório/órgãos) nas limitações,
-- além de muscular/articular/neural.
ALTER TABLE public.student_body_limitations DROP CONSTRAINT IF EXISTS student_body_limitations_type_check;
ALTER TABLE public.student_body_limitations
  ADD CONSTRAINT student_body_limitations_type_check
  CHECK (type IN ('muscular','articular','neural','organic'));
