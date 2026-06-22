# Prescrição de força sem IA (apenas gerador determinístico)

## Objetivo
Fazer a prescrição de musculação parar de chamar a IA (Anthropic) e passar a usar **apenas o gerador determinístico (fallback)** já existente no repositório de referência `bn-performance-app`. O treino é montado por regras (objetivo, nível, dias/semana, restrições e avaliação funcional) a partir da biblioteca de exercícios da empresa.

## Como funciona o gerador (do repo de referência)
1. Carrega o catálogo de exercícios da empresa (globais + da empresa) com seus grupos musculares e alvos.
2. Escolhe um "preset metodológico" pelo objetivo/nível/restrições (ex.: hipertrofia iniciante, força, emagrecimento, retorno de lesão, corrida+musculação).
3. Monta 2 a 4 treinos (A/B/C) seguindo a estrutura BN (mobilidade → core → ativação → controle motor → força global → força específica), escolhendo exercícios por palavras-chave e penalizando os que tenham risco para a restrição informada (joelho, lombar, ombro etc.).
4. Retorna o plano no **mesmo formato JSON** que a função atual já salva em `ai_strength_plans`, então o frontend e o restante do fluxo continuam funcionando sem alteração.

## Mudanças

### 1. Edge function `supabase/functions/ai-prescribe-workout/index.ts` (reescrita)
- Remover a chamada à Anthropic, o `SYSTEM_PROMPT` e a dependência de `ANTHROPIC_API_KEY`.
- Portar do repo de referência apenas o necessário (sem IA, sem shadow engine, sem `company_ai_config`/`ai_decision_logs`, que não existem neste projeto):
  - helpers: `clean`, `normalizeText`, `isRecord`, `chunkArray`, `selectByExerciseIdChunks`
  - `loadExerciseCatalog` (consulta `exercise_library`, `exercise_muscle_targets`, `muscle_groups`, `company_exercise_volumes`; `exercise_metadata` fica opcional e é ignorada se não existir)
  - `METHODOLOGY_PRESETS` + `selectMethodologyPreset`
  - `exerciseText`, `pickCatalogExercise`, `fallbackExercise`, `buildEmergencyFallbackPlan`
- Fluxo do handler:
  1. autentica o usuário (mantém `requireUser`)
  2. carrega o catálogo da empresa
  3. seleciona o preset
  4. gera o plano com `buildEmergencyFallbackPlan` (campo `generated_by: "bn_deterministic_engine"`)
  5. salva em `ai_strength_plans` e retorna `{ id, plan }` (mesma assinatura de hoje)
- Se a empresa não tiver exercícios no catálogo, retorna erro claro pedindo para cadastrar exercícios na Biblioteca antes de prescrever.

### 2. Frontend `src/pages/admin/UnifiedPrescriber.tsx` (ajuste de texto)
- Trocar o título "Prescrição Integrada com IA" e o subtítulo para refletir geração automática por metodologia (sem mencionar IA), ex.: "Prescrição Integrada" / "Anamnese única · prescrição automática por metodologia BN".
- Nenhuma mudança de lógica: continua chamando `ai-prescribe-workout` e exibindo o plano retornado.

## Fora de escopo (confirmar depois)
- `ai-running-plan` (plano de corrida) e `ai-functional-assessment` continuam usando IA. O pedido foi sobre a prescrição de treino (força). Se você quiser, num passo seguinte aplico a mesma abordagem determinística para a corrida.
- Não removo o segredo `ANTHROPIC_API_KEY` (fica inofensivo, sem uso na prescrição de força).

## Validação
- Conferir build da edge function.
- Gerar uma prescrição de teste para um aluno com exercícios na biblioteca e confirmar que o plano A/B/C aparece normalmente, sem chamada à Anthropic (checar logs da função).
