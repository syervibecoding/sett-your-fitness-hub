# Relatório — Testes Offline do Pipeline de Revisão (Curadoria v1)

> **ORDEM 033.** Bateria de testes offline do pipeline de revisão humana
> (`validate-curation-review-board.mjs` + `build-approved-curation-manifest.mjs`), com fixtures
> **temporárias** geradas em `os.tmpdir()` e removidas ao final. **Sem banco, sem SQL, sem deploy.**

## 1. Resumo executivo
**Review Pipeline Offline Tests = PASS** — **15/15** cenários passaram (após 1 fix justificado).
Harness: `scripts/prescription/test-curation-review-pipeline.mjs` (exit code 0).

## 2. Escopo
Os testes são **offline e temporários**: geram CSVs de fixture em diretório temporário do SO,
invocam os **scripts reais** (validator e builder) como subprocessos `node`, conferem `PASS/FAIL`
por cenário e **removem as fixtures** ao final. **Não** conectam no Supabase, **não** executam SQL,
**não** alteram o banco, **não** fazem deploy. As únicas saídas dos subprocessos vão para o diretório
temporário (nunca para o repo).

## 3. Cenários executados
| # | Cenário | Objetivo | Esperado | Observado | Status |
|---|---|---|---|---|---|
| 1 | `current_p1_needs_review` | P1 real 100% needs_review | validator PASS; builder header-only; approved=0; ready=0 | validator=0; builder=0; dataRows=0; approved0=true; ready0=true | **PASS** |
| 2 | `valid_single_approved` | 1 approved válido + 1 needs_review | validator PASS; builder 1 linha; nomes finais; needs_review fora | validator=0; builder=0; dataRows=1; finalNames=true | **PASS** |
| 3 | `approved_missing_reviewer_name` | approved sem reviewer_name | validator FALHA; builder sem dados | validator=1; builder=1; dataRows=0 | **PASS** |
| 4 | `approved_missing_reason` | approved sem approval_decision_reason | validator FALHA | validator=1 | **PASS** |
| 5 | `needs_review_ready_true` | needs_review com ready=true | validator FALHA; builder não aprova | validator=1; builder=1; dataRows=0 | **PASS** |
| 6 | `applied_status_rejected_by_pipeline` | reviewer_status=applied | validator FALHA; builder FALHA | validator=1; builder=1; dataRows=0 | **PASS** |
| 7 | `rejected_without_reason` | rejected sem motivo | validator FALHA | validator=1 | **PASS** |
| 8 | `needs_more_info_without_notes` | needs_more_info sem reviewer_notes | validator FALHA | validator=1 | **PASS** |
| 9 | `approved_with_conflict_without_notes` | approved + conflict_notes sem reviewer_notes | validator FALHA | validator=1 | **PASS** |
| 10 | `unknown_substitute` | substitute claramente inexistente | validator FALHA (erro, não warning); builder não gera a linha | validator=1; builder=1; dataRows=0 | **PASS** |
| 11 | `duplicate_exercise_id` | exercise_id duplicado | validator FALHA | validator=1 | **PASS** |
| 12 | `wrong_priority_for_p1` | max_priority=P2 com --expect-priority P1 | validator FALHA | validator=1 | **PASS** |
| 13 | `invalid_status` | reviewer_status=maybe | validator FALHA | validator=1 | **PASS** |
| 14 | `approved_multiple_risk_regions_requires_notes` | approved multi-região sem notes | validator FALHA | validator=1 | **PASS** |
| 15 | `approved_multiple_sources_requires_notes` | approved multi-source sem notes | validator FALHA | validator=1 | **PASS** |

**TOTAL: 15 | PASS: 15 | FAIL: 0**

## 4. Arquivos testados
- **Validator:** `scripts/prescription/validate-curation-review-board.mjs`
- **Builder:** `scripts/prescription/build-approved-curation-manifest.mjs`
- **Consolidated manifest:** `docs/prescription/library-curation-v1-consolidated-manifest.csv`
- **P1 human review CSV:** `docs/prescription/library-curation-v1-p1-human-review.csv`

## 5. Resultado atual do P1 real
- **100% `needs_review`** (51 linhas).
- **Approved manifest real vazio / só header** (`library-curation-v1-approved-manifest-p1.csv`).
- **Nenhum dado aprovado.**
- **Nenhum dado aplicado** no banco.
- Validador contra o P1 real: **0 errors**, 222 warnings (ambiguidade textual — cues de texto livre em
  `progressions`/`regressions` + variantes reais fora do manifesto-215). Builder: `NO_APPROVED_ROWS`.

## 6. Correções feitas
**1 fix real** revelado pelo cenário 10 (`unknown_substitute`):
- **Bug:** um substituto claramente sentinela/código (`EXERCICIO_INEXISTENTE_ATENA_TESTE`) numa linha
  `approved` — que seria aplicada no banco — produzia apenas **warning**, deixando o validator/builder
  **passarem** e o builder **emitir** a linha. Risco: dado inválido entrar no approved manifest.
- **Fix (mínimo):** estendido o helper `looksLikeNonExercise` em **ambos** os scripts (validator e
  builder) para também classificar como **claramente desconhecido (erro)** tokens em
  *SCREAMING_SNAKE/código* — regex `^[A-Z0-9_]+$`, `length >= 6` e contendo `_`. Mantém nomes reais
  (Title Case com espaços/acentos) e cues de texto livre (`ROM indolor`) como **warning**, sem
  regressão.
- **Teste que cobre:** cenário 10 (`unknown_substitute`) — antes `FAIL`, agora `PASS`. Confirmado que o
  P1 real continua com **0 errors** (sem regressão).

## 7. Segurança
- **Não** conectou no Supabase.
- **Não** executou SQL.
- **Não** alterou o banco.
- Fixtures foram **temporárias** (em `os.tmpdir()`, removidas ao final; não commitadas).
- **Não** commitou dados `approved` reais (approved manifest segue vazio/só header).
- **Não** alterou edge/engine de prescrição/UI.
- **Não** fez deploy / flag / cutover.

## 8. Decisão
**Review Pipeline = ACCEPT_WITH_FIXES** — 15/15 cenários PASS; 1 correção mínima e justificada nos
scripts validator/builder (detecção de substituto sentinela), sem regressão no P1 real.
