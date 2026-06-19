# Review Outbox v1 — Comandos de Processamento do Retorno

> **ORDEM 046.** Comandos para processar **cada arquivo devolvido** pelo revisor, usando o outbox
> original como `sent` (fonte da verdade) e o devolvido como `returned`. **NÃO rodar com devolvidos
> reais nesta ordem — apenas documentação.** Salvar os devolvidos em pasta separada (ex.:
> `docs/prescription/review-inbox/v1/`), nunca sobrescrevendo o outbox.

## Pré-requisito por arquivo
Antes do pipeline, rodar o **return guard** (sent = outbox original; returned = arquivo devolvido):
```bash
node scripts/prescription/check-curation-review-return.mjs \
  --sent <outbox-original> --returned <devolvido> --expect-priority <PX> \
  --report <report>
```

## Core P1
```bash
# sent     = docs/prescription/review-outbox/v1/p1-core-human-review.csv
# returned = docs/prescription/review-inbox/v1/p1-core-human-review.csv  (futuro)
# priority = P1 ; label = library-curation-v1-p1-core-returned
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --sent docs/prescription/review-outbox/v1/p1-core-human-review.csv \
  --returned docs/prescription/review-inbox/v1/p1-core-human-review.csv \
  --priority P1 --out-dir docs/prescription --label library-curation-v1-p1-core-returned
```

## Core P2
```bash
# priority = P2 ; label = library-curation-v1-p2-core-returned
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --sent docs/prescription/review-outbox/v1/p2-core-human-review.csv \
  --returned docs/prescription/review-inbox/v1/p2-core-human-review.csv \
  --priority P2 --out-dir docs/prescription --label library-curation-v1-p2-core-returned
```

## Core P3
```bash
# priority = P3 ; label = library-curation-v1-p3-core-returned
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --sent docs/prescription/review-outbox/v1/p3-core-human-review.csv \
  --returned docs/prescription/review-inbox/v1/p3-core-human-review.csv \
  --priority P3 --out-dir docs/prescription --label library-curation-v1-p3-core-returned
```

## Catalog Delta P1
> Os ids do delta estão **fora** do manifesto consolidado → usar o **manifest de referência delta**.
```bash
# priority = P1 ; label = library-curation-v1-p1-catalog-delta-returned
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-catalog-delta-human-review.csv \
  --sent docs/prescription/review-outbox/v1/p1-catalog-delta-human-review.csv \
  --returned docs/prescription/review-inbox/v1/p1-catalog-delta-human-review.csv \
  --priority P1 --out-dir docs/prescription --label library-curation-v1-p1-catalog-delta-returned
```

## Catalog Delta P2
```bash
# priority = P2 ; label = library-curation-v1-p2-catalog-delta-returned
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-catalog-delta-human-review.csv \
  --sent docs/prescription/review-outbox/v1/p2-catalog-delta-human-review.csv \
  --returned docs/prescription/review-inbox/v1/p2-catalog-delta-human-review.csv \
  --priority P2 --out-dir docs/prescription --label library-curation-v1-p2-catalog-delta-returned
```

## Catalog Delta P3
```bash
# priority = P3 ; label = library-curation-v1-p3-catalog-delta-returned
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-catalog-delta-human-review.csv \
  --sent docs/prescription/review-outbox/v1/p3-catalog-delta-human-review.csv \
  --returned docs/prescription/review-inbox/v1/p3-catalog-delta-human-review.csv \
  --priority P3 --out-dir docs/prescription --label library-curation-v1-p3-catalog-delta-returned
```

## Após o pipeline
- Revisar o approved manifest gerado e o SQL **no-op**.
- **Nunca** rodar SQL `staging`/`production` sem ordem ATENA + backup.
- **Não** editar os arquivos do outbox (eles são o baseline de comparação).
