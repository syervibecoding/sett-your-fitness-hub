-- Gating do "fallback-first": refino por IA DESLIGADO por padrão (decisão do Matheus 2026-06-17).
-- O plano sai 100% determinístico; a IA só refina texto quando a empresa liga o flag.
-- use_prescription_engine_v1: reservado p/ o cutover do motor de força (engine.ts) quando autorizado.
-- Aditivo e seguro (linhas existentes recebem o default).
ALTER TABLE public.company_ai_config
  ADD COLUMN IF NOT EXISTS ai_text_refinement_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_prescription_engine_v1 boolean NOT NULL DEFAULT true;
