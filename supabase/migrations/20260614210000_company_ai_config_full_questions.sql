-- Central de IA (config do professor): campos completos para moldar a IA ao dono da unidade.
-- A IA (prescrição, avaliação, conversa com aluno) passa a usar estes campos como persona/regras.
ALTER TABLE public.company_ai_config
  ADD COLUMN IF NOT EXISTS owner_credentials text,      -- quem é o dono / formação / autoridade
  ADD COLUMN IF NOT EXISTS niche_audience text,         -- público e nicho
  ADD COLUMN IF NOT EXISTS exercise_preferences text,   -- exercícios/padrões preferidos e evitados
  ADD COLUMN IF NOT EXISTS progression_model text,      -- progressão de carga/evolução
  ADD COLUMN IF NOT EXISTS assessment_protocol text,    -- protocolo de avaliação/acompanhamento
  ADD COLUMN IF NOT EXISTS red_lines text,              -- linhas vermelhas / contraindicações
  ADD COLUMN IF NOT EXISTS communication_style text,    -- como falar com o aluno
  ADD COLUMN IF NOT EXISTS nutrition_scope text,        -- até onde vai em nutrição
  ADD COLUMN IF NOT EXISTS ethical_limits text;         -- limites éticos
