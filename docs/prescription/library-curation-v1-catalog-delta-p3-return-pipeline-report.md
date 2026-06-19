# Relatório do Pipeline de Devolução da Curadoria (offline)

> Gerado por `scripts/prescription/run-curation-review-return-pipeline.mjs` (ATENA / ORDEM 039).
> **Offline** — encadeia return guard → validador → approved manifest → SQL no-op → este relatório.

## Status final: ✅ PASS

## Entradas
- Label: `library-curation-v1-catalog-delta-p3`
- Prioridade: `P3`
- Manifesto: `docs/prescription/library-curation-v1-catalog-delta-human-review.csv`
- Enviado (sent): `docs/prescription/library-curation-v1-catalog-delta-p3-human-review.csv`
- Devolvido (returned): `docs/prescription/library-curation-v1-catalog-delta-p3-human-review.csv`
- Out-dir: `docs/prescription`
- keep-going: `false`
- Timestamp: `2026-06-19T09:13:02.985Z`

## Status por passo
| # | passo | resultado | exit |
|---|---|---|---|
| 1 | return guard | PASS | 0 |
| 2 | validador | PASS | 0 |
| 3 | approved manifest | PASS | 0 |
| 4 | SQL no-op | PASS | 0 |

## Relatórios e artefatos gerados
- `docs/prescription/library-curation-v1-catalog-delta-p3-return-guard-report.md`
- `docs/prescription/library-curation-v1-catalog-delta-p3-human-review-validation-report.md`
- `docs/prescription/library-curation-v1-approved-manifest-p3-report.md`
- `docs/prescription/library-curation-v1-approved-manifest-p3.csv` (approved manifest CSV)
- `docs/prescription/library-curation-v1-approved-manifest-p3-upsert.noop.sql` (SQL no-op)

## Métricas do approved manifest
| métrica | valor |
|---|---|
| approved_rows | 0 |
| ready_for_upsert_rows | 0 |
| SQL mode | noop |

## Confirmações de segurança
- offline
- sem banco
- sem SQL executado
- sem dados aplicados
- sem deploy
- sem flag
- sem cutover

