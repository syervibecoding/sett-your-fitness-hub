# BN Prescription Engine v1 — Aceitação do Shadow Mode (B5/B6) + Hardening/Contrato (B7)

## 1. Status

- **B5/B6 = `ACCEPT_WITH_NOTES`**
- **B7 (contract/hardening) = `ACCEPT_WITH_NOTES`**

Motivo:
- Shadow mode implementado **atrás da flag** `PRESCRIPTION_ENGINE_V1`, **default off**.
- **Resposta principal preservada** (`{ id, plan }` intocada) e `buildEmergencyFallbackPlan`/Anthropic intactos.
- Logs em **`ai_decision_logs` sem migration** (`source='prescricao'` + `payload.kind='shadow_comparison'`).
- **Contrato PDF/publicação/portal validado** depois (ORDEM 016) contra plano real do engine.
- **`deno check` ainda pendente** (Deno indisponível na máquina; pendência Codex/CI).

## 2. Commits auditados

| Commit | O quê |
|---|---|
| `b917bb2` | claude: add prescription engine shadow mode (edge + `_shared/prescription/shadow.ts` + teste) |
| `478967c` | claude: add prescription shadow acceptance tests (hardening, 20 checks) |
| `f1c15bd` | claude: add prescription pdf/publish/portal contract tests |
| `75b46dc` | claude: add prescription engine pre-deploy checklist |
| `c7294c8` | claude: add prescription engine codex review package |

## 3. Comportamento da flag `PRESCRIPTION_ENGINE_V1`

| Valor | Roda engine novo? | Altera `{id, plan}`? | Grava log? | Pode ir p/ produção? | Observação |
|---|---|---|---|---|---|
| **ausente** | Não | Não | Não | **Sim** | Equivale a off (estado atual) |
| **off** | Não (nem importa) | Não | Não | **Sim** | Default seguro |
| **inválida** | Não | Não | Não | **Sim** | `resolveEngineFlag` → off |
| **shadow** | Sim (paralelo) | **Não** | Sim | Só sob ordem | Observação/medição; engine só p/ log |
| **on** | Sim (comparação) | **Não** (sem cutover) | Sim | **Não** | Reconhecido no código; cutover real NÃO implementado/autorizado |

Regra: ausente/off/inválida = comportamento atual; shadow = paralelo sem alterar resposta; on = reconhecido,
mas cutover continua **NOT_AUTHORIZED**.

## 4. Matriz de checks (23)

| # | Check | Tipo | Resultado |
|---|---|---|---|
| 1 | Flag ausente → off | Unit | ✅ PASS |
| 2 | Flag inválida → off | Unit | ✅ PASS |
| 3 | Flag off não chama engine novo | STATIC (edge) | ✅ engine só via `import()` dinâmico + guard de flag |
| 4 | shadow monta comparação sem alterar plano principal | STATIC (edge) | ✅ `currentPlan: planJson`; resposta intocada |
| 5 | on reconhecida, mas não serve plano novo | Unit + STATIC | ✅ `resolveEngineFlag("on")="on"`; edge sem `plan: program`/`plan: output` |
| 6 | Erro no shadow não quebra fluxo | STATIC (edge) | ✅ `catch (shadowError)` (log best-effort) |
| 7 | Log usa source='prescricao' + kind='shadow_comparison' | Unit + STATIC | ✅ constantes + `source: shadow.SHADOW_LOG_SOURCE` |
| 8 | Payload serializável em JSON | Unit | ✅ PASS |
| 9 | Sem dados sensíveis desnecessários | Unit | ✅ nome/restrições/anamnese crus ausentes (sentinelas) |
| 10 | Preserva blocker/handoff no resumo novo | Unit | ✅ EVA>5 → handoff_count 1 + blockers |
| 11 | Mede missing_exercises | Unit | ✅ `[]` c/ catálogo completo; detecta quando falta id |
| 12 | Mede safe_alternative_unavailable_count | Unit | ✅ ≥1 sem substituto seguro |
| 13 | Mede volume_by_group_delta | Unit | ✅ objeto de deltas numéricos |
| 14 | Mede timing_ms | Unit | ✅ PASS |
| 15 | buildEmergencyFallbackPlan presente | STATIC (edge) | ✅ |
| 16 | Anthropic/OpenAI presentes | STATIC (edge) | ✅ `ANTHROPIC_API_KEY` |
| 17 | Nenhuma migration adicionada | STATIC (git) | ✅ `b917bb2` sem migration |
| 18 | Nenhum arquivo UI/PDF/publicação alterado | STATIC (git) | ✅ `b917bb2` = só edge + shadow.ts + teste |
| 19 | Contrato de resposta continua `{ id, plan }` | STATIC (edge) | ✅ `JSON.stringify({ id: planId, plan: planJson })` |
| 20 | off semanticamente igual ao anterior | STATIC (edge) | ✅ bloco guardado por flag; engine só carrega fora de off |
| 21 | Contrato PDF/publicação/portal validado por teste real | Unit | ✅ ORDEM 016 (`contract-pdf-portal.test.ts`, 5 testes) |
| 22 | Deploy não foi executado | Fato/git | ✅ nenhum deploy; só commits locais |
| 23 | Flag ON não foi autorizada | Fato | ✅ default off em todo ambiente; sem cutover |

**Total: 23/23.** Os STATIC cobrem a edge Deno (não executável no Vitest) por leitura do arquivo/git.

## 5. Logs de shadow

- **Tabela:** `ai_decision_logs` (sem migration).
- **`source = 'prescricao'`** + **`payload.kind = 'shadow_comparison'`**.
- **Por que não `source='prescricao_shadow'`:** o `source` tem `CHECK IN ('prescricao','avaliacao','bnito')`
  → um valor novo exigiria migration; o discriminador fica no `payload.kind` (sem migration).
- **Payload mínimo esperado:**
```json
{
  "kind": "shadow_comparison",
  "engine": "bn_prescription_engine_v1",
  "mode": "shadow",
  "old_engine_summary": { "generated_by": "...", "split": "...", "workouts": 4, "status": "ok", "blockers": [], "warnings": [], "volume_by_group": {} },
  "new_engine_summary": { "generated_by": "bn_prescription_engine_v1", "split": "...", "workouts": 4, "status": "ok", "blocked": false, "handoff": false, "blockers": [], "warnings": [], "volume_by_group": {} },
  "diff": { "split_changed": true, "volume_by_group_delta": {}, "blockers_delta": 0, "warnings_delta": 0, "missing_exercises": [], "safe_alternative_unavailable_count": 0, "handoff_count": 0 },
  "timing_ms": 7,
  "created_by_edge": true
}
```
- **Erro no shadow não quebra o fluxo principal:** todo o bloco está em `try/catch`; em falha, grava um log
  de erro best-effort (também em `try/catch`), sem afetar a prescrição/retorno ao aluno.

## 6. Contrato PDF/publicação/portal (ORDEM 016, `f1c15bd`)

Validado contra um **plano real do engine** (via output adapter), **sem alterar UI/PDF/publicação**:
- **`buildWorkoutRows`**: gera linhas válidas pro app do aluno (cycle_id/company_id/sort_order; exercícios com
  `exercise_id` da biblioteca, `exercise_name`, `sets/reps/rest/notes` como string) — contrato `StudentWorkoutExercise`.
- **`mapStrengthExercise`**: mapeia `rest_seconds → "Ns"` e `cues → notes`.
- **`generateStrengthPDF` / `generateAllPDFs`**: **rodam sem lançar**; **jsPDF renderiza** o PDF de musculação.
- Conclusão: o **plano do engine é consumível** pelo PDF, pela publicação e pelo portal do aluno — contrato preservado.

## 7. Segurança

- O **plano atual (IA/fallback) continua sendo o retorno ao aluno** em todos os modos desta fase.
- **Blocker/handoff do engine novo ficam só no log** (em shadow), nunca na resposta.
- **Nenhum diagnóstico clínico é gerado** — só métricas/contagens; handoff é flag/contagem.
- **Sem dados sensíveis desnecessários no payload** (sentinelas de nome/restrições/anamnese ausentes — testado).
- **`buildEmergencyFallbackPlan` preservado**; **Anthropic/OpenAI preservados**.

## 8. Limitações

- **`deno check` pendente** (Deno indisponível local) — validar edge + `_shared` no runtime Deno (Codex/CI).
- **Shadow não rodou em ambiente Supabase real** (flag off em todo ambiente).
- **Sem amostra real de produção** (engine × IA/fallback).
- **Performance real não medida** (`timing_ms` só em teste unitário).
- **Codex ainda não revisou** (pacote em `bn-prescription-engine-v1-codex-review-package.md`).
- **Cutover não implementado** (`on` não serve o plano do engine).

## 9. Decisão

- **B5/B6 = `ACCEPT_WITH_NOTES`**
- **B7 = `ACCEPT_WITH_NOTES`**
- **B8 / Cutover = `NOT_AUTHORIZED`**
- **Deploy = `NOT_AUTHORIZED`**
- **Flag ON = `NOT_AUTHORIZED`** (default off em todo ambiente)
