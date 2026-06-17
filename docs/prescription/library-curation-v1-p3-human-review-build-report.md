# Relatório de Build do Pacote Humano de Revisão — offline

> Gerado por `scripts/prescription/build-human-review-packet.mjs` (ORDEM 034).
> **Offline** — não conecta no banco, não executa SQL, não altera dados.

## Status: OK

## Entradas
- Manifesto: `docs/prescription/library-curation-v1-consolidated-manifest.csv`
- Prioridade: `P3`
- Saída CSV: `docs/prescription/library-curation-v1-p3-human-review.csv`

## Contagens
| métrica | valor |
|---|---|
| priority | P3 |
| total_rows | 86 |
| rows_with_conflict_notes | 7 |
| rows_with_multiple_risk_regions | 3 |
| rows_with_multiple_source_packages | 6 |
- **errors:** 0
- **warnings:** 0

> Todas as linhas geradas: `reviewer_status=needs_review`, `ready_for_upsert=false`. Nada aprovado.

## Erros
- (nenhum)

## Warnings
- (nenhum)

