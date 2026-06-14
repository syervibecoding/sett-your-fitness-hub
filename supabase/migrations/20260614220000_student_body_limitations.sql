-- Limitações do aluno no boneco (perfil do aluno): preenchimento MANUAL pelo professor,
-- além do que vem da avaliação funcional. Uma limitação por região (region = BodyRegionId).
create table if not exists public.student_body_limitations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  company_id uuid not null,
  region text not null,
  type text not null check (type in ('muscular','articular','neural')),
  severity text check (severity in ('leve','moderada','severa')),
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, region)
);
alter table public.student_body_limitations enable row level security;

create policy "Company staff manage body limitations"
  on public.student_body_limitations for all
  using (company_id = public.get_user_company_id(auth.uid()))
  with check (company_id = public.get_user_company_id(auth.uid()));

create policy "Master full body limitations"
  on public.student_body_limitations for all
  using (public.has_role(auth.uid(), 'master'::app_role))
  with check (public.has_role(auth.uid(), 'master'::app_role));

create policy "Student reads own body limitations"
  on public.student_body_limitations for select
  using (student_id in (select s.id from public.students s where s.user_id = auth.uid()));
