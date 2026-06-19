# Review Outbox v1 — QA Final vs Catálogo Vivo

> **ORDEM 044 (auditoria final do outbox v1).** Valida integridade, congelamento e cobertura do outbox
> contra o catálogo vivo atual. **Banco intocado; somente `SELECT` read-only; nada aplicado.**

## 1. Resumo executivo
**Status: ACCEPT.** O outbox v1 está **íntegro** (checksums batem), **congelado** (0 approved / 0
ready), e **cobre exatamente** o catálogo vivo atual (**749 = 749**, `outbox == live`). As lacunas
restantes (metadata/target primário/equipment) são **de conteúdo** — exatamente o que a revisão humana
vai preencher — e **não** bloqueiam o envio.

## 2. Integridade do outbox
| Arquivo | Existe | Checksum | Linhas | approved | ready_true | Status |
|---|---|---|---|---|---|---|
| `p1-core-human-review.csv` | ✅ | OK | 51 | 0 | 0 | OK |
| `p2-core-human-review.csv` | ✅ | OK | 78 | 0 | 0 | OK |
| `p3-core-human-review.csv` | ✅ | OK | 86 | 0 | 0 | OK |
| `p1-catalog-delta-human-review.csv` | ✅ | OK | 134 | 0 | 0 | OK |
| `p2-catalog-delta-human-review.csv` | ✅ | OK | 248 | 0 | 0 | OK |
| `p3-catalog-delta-human-review.csv` | ✅ | OK | 152 | 0 | 0 | OK |

Checksums conferidos contra `review-outbox-manifest.json` (6/6 batem). Sem `exercise_id` duplicado em
nenhum arquivo. Return-guard baselines presentes para os 6.

## 3. Cobertura de catálogo vivo
| Métrica | Valor |
|---|---|
| total live catalog | **749** |
| baseline anterior | 447 |
| total outbox unique exercise_ids | **749** (core 215 + delta 534) |
| **live_not_in_outbox** | **0** |
| **outbox_not_in_live** | **0** |
| live_not_in_manifest (coberto pelo delta) | 534 |
| missing_metadata | **749** (metadata vazia) |
| missing_primary_target | **368** |
| missing_equipment | **447** |

`outbox == live` → **TRUE**. `core == consolidated_manifest` (215) → **TRUE**. Todo o catálogo vivo está
coberto por algum pacote (core ou delta).

> Nota de verificação: o dump inicial dos ids vivos colado localmente veio com 748 ids (1 perdido no
> paste: `28b739a6-…` "Agachamento profundo isométrico"); confirmado por `SELECT` que ele **existe** no
> banco → não é gap. Após correção: cobertura **749/749** exata.

## 4. Gaps encontrados
- **Estruturais (críticos):** **nenhum** (`outbox-catalog-gap.csv` = só header).
- **De conteúdo (não críticos, esperados — alvo da revisão humana):**
  - 749 sem metadata (contraindications/pain tags/substitutos/regressões).
  - 368 sem target primário.
  - 447 sem equipment.
- **Ações recomendadas:** revisão humana preenche metadata/equipment; pliometria/Performance com cautela
  `high_skill/impact` (gate por nível/dor, sem semanas 1–2).

## 5. Runtime coverage
- **Runtime Catalog Coverage = ACCEPT.** Ref.: `bn-prescription-engine-v1-catalog-coverage-report.md` +
  `bn-prescription-engine-v1-catalog-delta-report.md`.
- **Hardcode antigo problemático?** **Não.** O único limitador (`.limit(700)` da edge) foi corrigido na
  ORDEM 044 (paginação). Engine itera o catálogo recebido inteiro; fallback de emergência também é
  catalog-driven (não usa lista estática).
- **Novos exercícios entram no pool?** **Sim** — inclusive sem metadata (mantidos com gap/warning, sem sumir).

## 6. Readiness para envio humano
- **Human Review Outbox = READY_TO_SEND.**
- Pode enviar **P1/P2/P3 core** e **P1/P2/P3 catalog_delta** ao revisor.
- Retornos do delta devem usar o **manifest de referência delta** (ver `review-return-commands.md`).

## 7. Segurança
- **0 approved**, **0 ready_for_upsert=true** (6/6 arquivos).
- **Banco intocado**; **somente `SELECT` read-only**; **nada aplicado**.
- Não tocou engine/edge/UI/PDF. **Deploy / Flag ON / Cutover = NOT_AUTHORIZED.**

## 8. Próxima ação recomendada
**READY_TO_SEND:**
1. Enviar o pacote (`README.md` + 6 CSVs) ao professor/curador.
2. Receber os CSVs revisados em pasta separada (`review-inbox/v1/`).
3. Rodar o pipeline de retorno usando o outbox original como `sent` (`review-return-commands.md`).
4. **Nunca** editar os arquivos do outbox (são o baseline de comparação).

> Pendências residuais (não bloqueiam o envio): `deno check` da edge (Deno indisponível localmente);
> shadow real de paridade segue bloqueado por metadata vazia até a curadoria ser aprovada/aplicada.
