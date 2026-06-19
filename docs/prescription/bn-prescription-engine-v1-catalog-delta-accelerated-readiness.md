# Prontidão Acelerada — Catalog Delta (BN Prescription Engine v1)

> **ORDEM 045 / Parte G.** Relatório consolidado do bloco acelerado (A–F). **Nada aplicado no banco;
> sem deploy/flag/cutover.**

## 1. Resumo executivo
- **Loader corrigido** (ORDEM 044): edge sem `.limit(700)`, paginação `range()` (page size 1000).
- **Catálogo vivo visível:** todos os 749 podem ser carregados como pool de candidatos.
- **Delta identificado:** 534 exercícios fora do manifesto consolidado.
- **Delta dividido por prioridade:** P1 134 · P2 248 · P3 152.
- **Pipeline offline rodado** nos 3 lotes → **PASS** (NO_APPROVED_ROWS / no-op).
- **Tudo pronto para revisão humana** (handoff + índice mestre).

## 2. Números
| Métrica | Valor |
|---|---|
| Total atual | **749** |
| Baseline anterior | 447 |
| Delta (novos, `created_at ≥ 2026-06-16`) | **+302** |
| Fora do manifesto (215) | **534** |
| catalog_delta P1 | 134 |
| catalog_delta P2 | 248 |
| catalog_delta P3 | 152 |
| approved_rows (todos os lotes) | **0** |

## 3. Runtime
- O **engine considera o catálogo recebido** (pool completo; sem lista antiga/hardcoded).
- A **edge não limita mais em 700** (paginação até esgotar a biblioteca).
- O **catálogo vivo pode passar inteiro** ao engine.

## 4. Curadoria
- O **delta precisa de revisão humana** (534 linhas, 100% `needs_review`).
- **Metadata ainda bloqueia shadow real de paridade** (`exercise_metadata` vazia).
- **Nenhum dado aplicado**; nenhum approved.

## 5. Pipeline offline (Parte D) — resultados
| Lote | Status | approved_rows | ready_for_upsert_rows | SQL |
|---|---|---|---|---|
| catalog_delta P1 | **PASS** | 0 | 0 | no-op |
| catalog_delta P2 | **PASS** | 0 | 0 | no-op |
| catalog_delta P3 | **PASS** | 0 | 0 | no-op |

> Manifest de referência usado: `library-curation-v1-catalog-delta-human-review.csv` (os ids do delta
> estão **fora** do manifesto consolidado por design — variação segura documentada na ORDEM, sem
> misturar o delta no manifesto consolidado). Approved-manifests do delta vazios/no-op não persistidos
> sob nomes genéricos colidentes (ver nota no split/índice).

## 6. Pendências
- `deno check` da edge: **PENDENTE** (Deno indisponível localmente).
- Revisão humana do catalog_delta (534).
- Curadoria de metadata para destravar shadow real.

## 7. Decisão
- **Catalog Runtime Coverage = ACCEPT**
- **Catalog Delta Review = PREPARED**
- **Shadow Real = NOT_AUTHORIZED**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
