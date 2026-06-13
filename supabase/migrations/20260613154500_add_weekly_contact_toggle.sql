-- Toggle "contato semanal" por aluno (lido pela automação do BNITO na Fase 3).
-- (aplicada no Bn-app via management API; este arquivo mantém o repo em sincronia.)
alter table public.students add column if not exists weekly_contact_enabled boolean not null default false;
