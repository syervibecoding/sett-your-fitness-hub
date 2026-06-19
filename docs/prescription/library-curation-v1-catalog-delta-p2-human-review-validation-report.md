# Relatório de Validação do Review Board (offline)

> Gerado por `scripts/prescription/validate-curation-review-board.mjs` (ORDEM 030).
> **Validador offline** — não conecta no banco, não executa SQL, não altera dados.

## Entradas
- Manifesto: `docs/prescription/library-curation-v1-catalog-delta-human-review.csv`
- Review CSV: `docs/prescription/library-curation-v1-catalog-delta-p2-human-review.csv`
- Prioridade esperada: `P2`

## Resumo
- Linhas no manifesto: **534**
- Linhas analisadas no review: **248**
- `ready_for_upsert=true`: **0**

### Total por `reviewer_status`
| status | total |
|---|---|
| needs_review | 248 |
| approved | 0 |
| rejected | 0 |
| needs_more_info | 0 |
| applied | 0 |

- **Errors:** 0
- **Warnings:** 0

## Resultado: ✅ PASS (0 errors)

## Erros
- (nenhum)

## Warnings
- (nenhum)

