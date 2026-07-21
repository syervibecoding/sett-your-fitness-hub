-- Prevent accidental duplicate student profiles inside the same company.
-- The indexes are partial so empty email/CPF fields remain allowed.

CREATE UNIQUE INDEX IF NOT EXISTS students_company_email_unique_idx
ON public.students (company_id, lower(btrim(email)))
WHERE company_id IS NOT NULL
  AND email IS NOT NULL
  AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS students_company_cpf_unique_idx
ON public.students (company_id, regexp_replace(cpf, '\D', '', 'g'))
WHERE company_id IS NOT NULL
  AND cpf IS NOT NULL
  AND regexp_replace(cpf, '\D', '', 'g') <> '';
