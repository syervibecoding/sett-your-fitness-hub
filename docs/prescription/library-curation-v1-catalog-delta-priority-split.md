# Split por Prioridade — Catalog Delta (Curadoria v1)

> **ORDEM 045 / Parte C.** Divide o `catalog_delta` (534 exercícios fora do manifesto) em lotes
> P1/P2/P3 para revisão humana. **Nada aprovado/aplicado; banco intocado.**

## 1. Total delta
**534** exercícios fora do manifesto consolidado (215) — fonte: `library-curation-v1-catalog-delta-human-review.csv`.

## 2. Total por prioridade
| Lote | Arquivo | Linhas |
|---|---|---|
| **P1** | `library-curation-v1-catalog-delta-p1-human-review.csv` | **134** |
| **P2** | `library-curation-v1-catalog-delta-p2-human-review.csv` | **248** |
| **P3** | `library-curation-v1-catalog-delta-p3-human-review.csv` | **152** |
| **Total** | — | **534** |

Colunas idênticas ao `catalog-delta-human-review` (20 colunas).

## 3. Confirmação 100% needs_review
Todos os 534 (P1/P2/P3) com `reviewer_status = needs_review`. ✅

## 4. Confirmação 0 approved
Nenhuma linha `approved` em nenhum lote. ✅

## 5. Confirmação ready_for_upsert
Todos com `ready_for_upsert = false` (ou vazio). ✅

## 6. Como revisar
- Ordem recomendada: **P1 → P2 → P3**.
- Editar **apenas** os campos permitidos (ver handoff `...-catalog-delta-human-review-handoff.md`).
- **Não** alterar `exercise_id`/`exercise_name` nem demais campos protegidos.
- Para `approved`: preencher `reviewer_name`, `reviewed_at`, `approval_decision_reason`,
  `ready_for_upsert=true`, e `reviewer_notes` em conflitos.

## 7. Não aplicar no banco
Estes lotes são **somente** para revisão humana. **Nada** deve ser aplicado, aprovado ou rodado como SQL.
O pipeline offline (Parte D) confirmou `NO_APPROVED_ROWS` / no-op para os três lotes.

> **Nota de naming (pipeline):** o `run-curation-review-return-pipeline.mjs` reusa nomes **genéricos**
> para approved-manifest/report/noop (`library-curation-v1-approved-manifest-pX.*`), que colidiriam com os
> artefatos das ORDENS 031/036. Para **não corromper** esses originais, os approved-manifests do delta
> (todos vazios/no-op, `approved_rows=0`) **não** foram persistidos sob nomes colidentes; a evidência do
> delta fica nos relatórios **label-derived** únicos: `...-catalog-delta-pX-return-guard-report.md`,
> `...-catalog-delta-pX-human-review-validation-report.md`, `...-catalog-delta-pX-return-pipeline-report.md`.
