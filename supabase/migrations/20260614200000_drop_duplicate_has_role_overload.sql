-- FIX (claude): edge functions de IA (ai-functional-assessment / ai-prescribe-workout /
-- ai-nutrition-plan) retornavam HTTP 500. Causa raiz: havia DOIS overloads de has_role:
--   has_role(uuid, app_role)  -- canônico (RLS)
--   has_role(uuid, text)      -- duplicado
-- O _shared/tenant-auth.ts chama rpc("has_role", { _role: "master" }) (string) → PostgREST
-- ficava ambíguo (PGRST203) e o erro era engolido → detecção de master quebrava → 500.
-- Removendo o overload text, o RPC resolve para has_role(uuid, app_role) coagindo "master".
DROP FUNCTION IF EXISTS public.has_role(uuid, text);
