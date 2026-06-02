# Prescrição Inteligente com IA (Set Training)

Trazer do repositório `sett-your-fitness-hub` as features de IA escolhidas: **Musculação**, **Corrida/Cardio**, **Avaliação Funcional (prescritora e avaliadora)** e o **Prescritor Integrado com anti-interferência**. Sem nutrição. Provedor: **Anthropic direto** (sua escolha).

## Contexto importante (por que adaptar, não copiar)

O repo evoluiu com um schema diferente do seu. Não dá para copiar as edge functions/migrations como estão:

- Lá `training_cycles` não tem `enrollment_id`; no seu projeto ele é **NOT NULL** e há triggers (`generate_training_cycles`, `resolve_build_workout_alert`) que dependem do vínculo com `enrollments`.
- Lá os exercícios usam tabela `workout_exercises`; no seu projeto ficam em `workouts.exercises` (jsonb).
- `students` usa `full_name` (no repo é `name`) e não tem `weight_kg`/`height_cm`.
- As tabelas `running_plans`, `functional_assessments`, `student_anamneses`, `prescription_bundles` não existem aqui.

**Decisão de arquitetura:** os planos gerados pela IA serão salvos em **tabelas novas, baseadas em JSON e desacopladas** do fluxo de execução atual do aluno. Assim nada quebra. Publicar o treino de musculação no portal do aluno (convertendo para `training_cycles`/`workouts`) fica como evolução futura.

## Banco de dados (migration)

Criar tabelas novas (todas com GRANTs + RLS company-scoped, padrão do projeto):

- `student_anamneses` — anamnese única por aluno (objetivo, nível, dias força/cardio, esporte, FC, lesões, etc.).
- `functional_assessments` — `queixa_principal`, `historico_lesoes`, `modalidade`, `nivel`, `ai_raw_response`, `report_text`, `assessment_json` (jsonb), `status`.
- `running_plans` — `plan_name`, `sport`, `goal`, `weeks` (jsonb), `fc_zones`, `safety_check`, `general_tips`, `warnings` (text[]), `complementary_strength` (jsonb), `nutrition_alert`, `duration_weeks`, `model`, `anamnese_id`, `bundle_id`.
- `ai_strength_plans` — `plan` (jsonb completo), `cycle_name`, `objective`, `duration_weeks`, `biomechanical_notes`, `anamnese_id`, `bundle_id`.
- `prescription_bundles` — agrupa as prescrições de um ciclo (`has_strength`, `has_cardio`, refs para os planos e a avaliação, `status`).

RLS: acesso por `company_members` (admin/coordinator/trainer da empresa); aluno lê a própria anamnese/planos.

## Edge functions (Anthropic)

Três funções adaptadas a partir do repo (limpando o texto de documentação que vem colado após o código, corrigindo CORS, validando JWT em código e salvando nas tabelas novas):

- `ai-prescribe-workout` → grava em `ai_strength_plans`. Recebe `running_days_context` e `assessment_context` (anti-interferência + avaliação funcional).
- `ai-running-plan` → grava em `running_plans`. Recebe `strength_plan_context` e `assessment_context` (sincronização de periodização).
- `ai-functional-assessment` → grava/atualiza `functional_assessments`; retorna `assessment_json` que alimenta as outras duas IAs.

Mantêm os system prompts de metodologia (biomecânica/OHS, zonas FC, regras de anti-interferência). Modelo Anthropic será fixado num nome válido atual (o `claude-sonnet-4-6` do repo será corrigido). Tratamento de erros 401/402/429 repassado ao cliente. Registradas no `supabase/config.toml` com `verify_jwt`.

## Frontend

- **`src/pages/admin/UnifiedPrescriber.tsx`** — adaptado: usa `full_name`, remove a modalidade de nutrição, mantém o fluxo sequencial Musculação → Corrida com context passing, e mostra a avaliação funcional mais recente. Exibe os resultados gerados.
- **`src/components/MusculacaoPrescriber.tsx`** e **`CorridaPrescriber.tsx`** — prescritores individuais (reaproveitados/adaptados).
- **`src/pages/admin/FunctionalAssessment.tsx`** (novo) — UI da avaliadora: formulário (queixa, histórico, achados do OHS) → gera relatório e armazena para uso nas prescrições.
- **Rotas** em `src/App.tsx`: `/admin/prescricao` (Prescritor Integrado), `/admin/avaliacao` (Avaliação Funcional), mais equivalentes para `coordinator`/`trainer`, protegidas por `FeatureRoute` com `requiredFeature="hasPrescription"`.
- **`src/components/AppSidebar.tsx`** — itens "Prescrição IA" e "Avaliação Funcional".
- **`useCompanyFeatures`** — gate da IA (sugiro liberar em `intermediate`+; confirmo na implementação).

## Pré-requisito

Como você escolheu Anthropic direto, vou precisar do segredo **`ANTHROPIC_API_KEY`** (pego em console.anthropic.com → API Keys). Vou solicitá-lo logo após a aprovação; as edge functions não funcionam sem ele.

## Detalhes técnicos

- Plans são salvos como JSON — a UI renderiza diretamente, sem depender do modelo de execução atual.
- Anti-interferência: a saída da IA de musculação (dias de MMII pesado) é passada para a IA de corrida; a avaliação funcional é injetada como contexto em ambas.
- Nada nas tabelas/triggers existentes (`training_cycles`, `workouts`, alerts) é alterado.

## Fora de escopo (por ora)

- Prescrição de nutrição (não selecionada).
- Publicar o treino de IA no portal de execução do aluno (futuro).
