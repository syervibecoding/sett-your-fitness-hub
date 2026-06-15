# BN Prescription Engine v1 — Aceitação Pós-Hotfix (Fase A)

## 1. Resumo

**Status: `ACCEPT_PROVISIONAL`**

- A **Fase A** (engine puro em `src/lib/prescription/**`) está **tecnicamente aceita** após o hotfix
  cirúrgico que resolveu o único blocker da auditoria (F1) e aplicou os recomendados F2–F4.
- A **Fase B (cutover para produção)** **ainda NÃO está autorizada** — o engine permanece como
  biblioteca pura, **não** acoplado à edge `ai-prescribe-workout`, à UI, ao PDF ou à publicação.
- **O Codex deve revisar o hotfix** (`ee4bfbe`) quando retornar. A aceitação é *provisória*
  justamente porque o fix em lane de IA/metodologia foi feito pelo executor temporário (Claude),
  não pelo dono da lane. Nada foi promovido para o caminho principal.

---

## 2. Commits considerados

| Commit | Mensagem |
|---|---|
| `dcb2d52` | claude: add bn prescription engine qa spec |
| `20e0448` | codex: add bn prescription engine core |
| `3eb24b4` | codex: align prescription engine with bn methodology spec |
| `9000d95` | codex: complete prescription engine qa coverage |
| `2fd7dcf` | claude: audit bn prescription engine core |
| `ee4bfbe` | claude: fix prescription pain progression gate |
| `469ce66` | claude: plan prescription engine phase b |

---

## 3. Verificação dos fixes

| Fix | O que mudou | Arquivo alterado | Teste correspondente | Resultado | Risco residual |
|---|---|---|---|---|---|
| **F1** | `hasPainContext` passou a considerar dor estruturada (`painReports[].eva`/`painEva`) via `classifyPainSeverity`; EVA > 3 sem texto agora trava progressão (`hold/regress`) e bloqueia método avançado | `progressionRules.ts` | "F1 — painReports EVA>3 sem texto trava progressão…" (falharia antes), "F1 — painEva estruturado…", "F1 — sem dor (clean) NÃO trava…" (anti-falso-positivo) | **PASS** | Baixo. Revisão do Codex pendente; depende de `classifyPainSeverity` (reuso correto, sem import circular) |
| **F2** | Redução por endurance só com **freq ≥3x** e **só em MMII** (−25%, faixa 20–30%); superiores preservados; `<3x` não corta; sem frequência → warning de agenda | `volumeRules.ts` | "F2 — endurance ≥3x reduz MMII e preserva superiores", "F2 — endurance <3x NÃO corta MMII", "F2 — endurance sem frequência emite warning" | **PASS** | Baixo. `isEnduranceAthlete` sem dias é tratado como 3 (conservador) + warning de agenda |
| **F3** | Textos de `target_weekly_sets` alinhados ao teto ativo (iniciante 12 / interm-avançado 16; 18–20 fora da v1) — sem mudança de regra | `presets.ts` | (cosmético; coberto indiretamente pelos testes de volume) | **PASS** | Nenhum (apenas texto) |
| **F4** | Teste prova hard cap no **output**: iniciante ≤12 (grupo grande), interm/avançado ≤16 (qualquer grupo), em 4 perfis | `engine.test.ts` | "F4 — teto de volume garantido no output por perfil" | **PASS** | Baixo. Cap garantido por geração conservadora + warning; não há truncamento duro (ver pendências) |

Observação: `targetVolumeRange` em `volumeRules.ts` é código não utilizado e **não foi alterado**.

---

## 4. Comandos (re-executados nesta aceitação)

| Comando | Resultado |
|---|---|
| `npm run test -- src/lib/prescription` | ✅ **41/41** |
| `npm run test` | ✅ **81/81** (8 arquivos) |
| `npm run build` | ✅ build ok (apenas warning de chunk-size pré-existente) |

---

## 5. Gates de segurança (confirmados)

| Gate | Status | Evidência |
|---|---|---|
| Dor > 3 trava progressão | ✅ | `shouldHoldProgression`/`progressionProtocol` → "hold/regress"; agora também para dor estruturada (F1) |
| EVA > 5 gera handoff | ✅ | `classifyPainSeverity` >5→severa → `alertTeacher` + blocker `high_pain_requires_professional_review`; GC-11 |
| Sem método avançado para iniciante | ✅ | `applySimpleCorrections` remove + warning `advanced_method_for_beginner` |
| Sem método avançado com dor | ✅ | strip por `hasPainContext` (corrigido em F1) + warning `advanced_method_with_pain` |
| Sem pliometria nas semanas 1–2 | ✅ | warning `plyometrics_in_block_1` + avoidKeywords + base "sem pliometria" |
| Biblioteca-only | ✅ | catálogo vazio→blocker `empty_exercise_library`; ID inválido→`exercise_outside_library`; seleção só do catálogo |
| Sem substituto seguro essencial → blocker | ✅ | gap `BLOCKER:safe_alternative_unavailable` → blocker; GC-10 |
| Volume hard cap 12/16 | ✅ | `hardCapsByLevel` (12 iniciante / 16 interm-avançado); F4 prova no output |
| Contrato aditivo preservado | ✅ | `TrainingProgram` mantém `cycle_name/objective/duration_weeks/workouts/periodization_blocks/library_policy/validator/bnito_after_generation` + aditivos `schemaVersion/engineMeta/validation/explanations` |

---

## 6. O que ainda NÃO está validado (pendente para Fase B)

- **Renderização real no portal/PDF** (E2E): o *shape* está preservado, mas não há teste de render
  ponta-a-ponta no app/PDF.
- **Import Deno/Supabase Edge**: validar imports `.ts` + `import type` ao mover o engine para a edge.
- **Adapter da edge**: tradutor do input real (anamnese/avaliação/catálogo de produção) → `PrescriptionInput`.
- **Shadow mode com dados reais**: rodar engine em paralelo ao fluxo atual e comparar saídas antes do cutover.
- **Qualidade dos metadados reais da biblioteca**: `contraindications`/`pain_limitation_tags`/
  `equivalent_substitutes`/`muscle_group`/`equipment` — metadados vazios elevam a taxa de blocker/gap.
- **Revisão independente do Codex no hotfix** (`ee4bfbe`): dono da lane de IA/metodologia deve revisar.
- **Divergência fallback ↔ engine**: definir fonte de verdade e plano de descontinuação de
  `buildEmergencyFallbackPlan` (não tocado nesta fase).
- **Cutover em produção**: virar a flag do engine como gerador principal — etapa separada, só após
  todos os gates da Fase B (ver `bn-prescription-engine-v1-phase-b-plan.md`, commit `469ce66`).

---

## 7. Decisão

- **Fase A = `ACCEPT_PROVISIONAL`** (tecnicamente aceita após hotfix; sujeita à revisão do Codex).
- **Fase B = `PLANNED_ONLY`** (plano técnico documentado em `bn-prescription-engine-v1-phase-b-plan.md`
  / commit `469ce66`; nenhuma implementação iniciada).
- **Cutover = `NOT_AUTHORIZED`** (engine não promovido a gerador principal; sem acoplamento a edge/UI/PDF/publicação).
- **Deploy = `NOT_AUTHORIZED`** (nenhum deploy de edge/Netlify autorizado nesta etapa).
