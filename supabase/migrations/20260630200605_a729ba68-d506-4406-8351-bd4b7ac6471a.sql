CREATE TABLE public.company_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  assistant_name text NOT NULL DEFAULT 'Setty',
  methodology text,
  tone text,
  doctrine text,
  ethical_limits text,
  student_assistant_enabled boolean NOT NULL DEFAULT true,
  staff_assistant_enabled boolean NOT NULL DEFAULT true,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_ai_config TO authenticated;
GRANT ALL ON public.company_ai_config TO service_role;

ALTER TABLE public.company_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View company ai config"
ON public.company_ai_config FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR company_id = public.get_user_company_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid() AND s.company_id = company_ai_config.company_id
  )
);

CREATE POLICY "Admins manage company ai config"
ON public.company_ai_config FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR (public.has_role(auth.uid(), 'admin') AND company_id = public.get_user_company_id(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'master')
  OR (public.has_role(auth.uid(), 'admin') AND company_id = public.get_user_company_id(auth.uid()))
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_company_ai_config_updated_at
BEFORE UPDATE ON public.company_ai_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();