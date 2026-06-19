# Review Outbox v1 — Índice de Arquivos

> **ORDEM 046.** Inventário dos 6 CSVs do outbox com fonte original, prioridade, pacote, linhas e SHA256.
> Checksums autoritativos em `review-outbox-manifest.json`.

| Arquivo | Fonte original | Prioridade | Pacote | Linhas | SHA256 | Enviar ao revisor | Observação |
|---|---|---|---|---|---|---|---|
| `p1-core-human-review.csv` | `docs/prescription/library-curation-v1-p1-human-review.csv` | P1 | core | 51 | `6005900d2b5fdd2c3b828dc0f4aa0769a444cfe1f8404b52c76e2647011be3ff` | **Sim** | manifesto v1 (alto risco) |
| `p2-core-human-review.csv` | `docs/prescription/library-curation-v1-p2-human-review.csv` | P2 | core | 78 | `6148e4122ed0ea17ff343d0d2bb918ef91f5c7dedd4a9bfeaf68b72032ed8bbf` | **Sim** | manifesto v1 (composto moderado) |
| `p3-core-human-review.csv` | `docs/prescription/library-curation-v1-p3-human-review.csv` | P3 | core | 86 | `b0a844e08c3716d596b7bd5386103a113e468a7a1c13ba7e880018f8a545a56d` | **Sim** | manifesto v1 (isolado/acessório) |
| `p1-catalog-delta-human-review.csv` | `docs/prescription/library-curation-v1-catalog-delta-p1-human-review.csv` | P1 | delta | 134 | `7e0ca565e612c9dcbd835d70d2312f124c29b2986e35416b25a9094f6abe4f62` | **Sim** | catalog_delta (validar com manifest delta) |
| `p2-catalog-delta-human-review.csv` | `docs/prescription/library-curation-v1-catalog-delta-p2-human-review.csv` | P2 | delta | 248 | `164332f5f0da1f5fe3833f050bd0f60850c26b8b0a875438b557f2ee96d7ccdc` | **Sim** | catalog_delta (validar com manifest delta) |
| `p3-catalog-delta-human-review.csv` | `docs/prescription/library-curation-v1-catalog-delta-p3-human-review.csv` | P3 | delta | 152 | `b180d7014a2f6d3eef4271c21d9e97fd23b32667d38feec957d81739d871da40` | **Sim** | catalog_delta (validar com manifest delta) |

**Totais:** 6 arquivos · 749 linhas · approved_rows **0** · ready_for_upsert_true **0**.

> Os arquivos `core` validam contra `library-curation-v1-consolidated-manifest.csv`; os `delta` validam
> contra um **manifest de referência delta** (`library-curation-v1-catalog-delta-human-review.csv`),
> pois os ids do delta estão **fora** do manifesto consolidado por design.
