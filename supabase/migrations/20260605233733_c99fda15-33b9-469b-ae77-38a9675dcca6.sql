-- 1. Anamnesis: add company-scoped UPDATE and DELETE policies
CREATE POLICY "Company scoped update"
  ON public.anamnesis
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company scoped delete"
  ON public.anamnesis
  FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- 2. Make get_user_company_id deterministic
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = _user_id
  ORDER BY created_at ASC, company_id ASC
  LIMIT 1
$function$;

-- 3. Move sensitive Stripe identifiers into a restricted billing table
CREATE TABLE public.company_billing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_billing TO authenticated;
GRANT ALL ON public.company_billing TO service_role;

ALTER TABLE public.company_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master full access billing"
  ON public.company_billing
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER update_company_billing_updated_at
  BEFORE UPDATE ON public.company_billing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data
INSERT INTO public.company_billing (company_id, stripe_customer_id, stripe_subscription_id)
SELECT id, stripe_customer_id, stripe_subscription_id
FROM public.companies
WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;

-- Remove sensitive columns from companies
ALTER TABLE public.companies DROP COLUMN stripe_customer_id;
ALTER TABLE public.companies DROP COLUMN stripe_subscription_id;