# Índice Mestre — Pacotes de Revisão Humana (Curadoria v1)

> **ORDEM 045 / Parte F.** Visão única de todos os pacotes de revisão humana (manifesto original +
> catalog_delta). **Todos PREPARED; approved manifests EMPTY; banco UNCHANGED.**

## Pacotes
| Pacote | Arquivo de revisão | Linhas | Prioridade | Approved manifest | Validation report | Pipeline report | Status | Enviar ao revisor? |
|---|---|---|---|---|---|---|---|---|
| **P1 original** | `library-curation-v1-p1-human-review.csv` | 51 | P1 | `library-curation-v1-approved-manifest-p1.csv` (EMPTY) | `library-curation-v1-p1-human-review-validation-report.md` | `library-curation-v1-p1-return-pipeline-report.md` | PREPARED | **Sim** |
| **P2 original** | `library-curation-v1-p2-human-review.csv` | 78 | P2 | `library-curation-v1-approved-manifest-p2.csv` (EMPTY) | `library-curation-v1-p2-human-review-validation-report.md` | — | PREPARED | **Sim** |
| **P3 original** | `library-curation-v1-p3-human-review.csv` | 86 | P3 | `library-curation-v1-approved-manifest-p3.csv` (EMPTY) | `library-curation-v1-p3-human-review-validation-report.md` | — | PREPARED | **Sim** |
| **catalog_delta P1** | `library-curation-v1-catalog-delta-p1-human-review.csv` | 134 | P1 | EMPTY (genérico¹, não persistido) | `library-curation-v1-catalog-delta-p1-human-review-validation-report.md` | `library-curation-v1-catalog-delta-p1-return-pipeline-report.md` | PREPARED | **Sim** |
| **catalog_delta P2** | `library-curation-v1-catalog-delta-p2-human-review.csv` | 248 | P2 | EMPTY (genérico¹, não persistido) | `library-curation-v1-catalog-delta-p2-human-review-validation-report.md` | `library-curation-v1-catalog-delta-p2-return-pipeline-report.md` | PREPARED | **Sim** |
| **catalog_delta P3** | `library-curation-v1-catalog-delta-p3-human-review.csv` | 152 | P3 | EMPTY (genérico¹, não persistido) | `library-curation-v1-catalog-delta-p3-human-review-validation-report.md` | `library-curation-v1-catalog-delta-p3-return-pipeline-report.md` | PREPARED | **Sim** |

Totais: original **215** (51+78+86) + catalog_delta **534** (134+248+152) = **749** exercícios cobertos por pacotes de revisão.

¹ O `run-curation-review-return-pipeline.mjs` reusa nomes genéricos de approved-manifest
(`library-curation-v1-approved-manifest-pX.*`); para não sobrescrever os artefatos das ORDENS 031/036,
os approved-manifests do delta (todos `approved_rows=0` / no-op) não foram persistidos sob nomes
colidentes — a evidência do delta está nos relatórios label-derived (guard/validation/pipeline).

## Estado global
- **Todos os pacotes:** `PREPARED` (100% `needs_review`).
- **Approved manifests:** `EMPTY` (nada aprovado).
- **Banco:** `UNCHANGED`.
- **Shadow real / Deploy / Flag ON / Cutover:** `NOT_AUTHORIZED`.
