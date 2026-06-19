# Review Outbox v1 — Pacote de Envio para Revisão Humana

> **ORDEM 046.** Cópia **versionada e congelada** dos 6 CSVs enviados ao professor/curador. Estes
> arquivos são a **fonte da verdade** (`sent`) para o return guard comparar o que voltar. **Não editar
> os arquivos deste outbox.** Nada foi aplicado no banco; tudo `needs_review`; approved manifests vazios.

## 1. Objetivo
Entregar ao revisor os metadados sugeridos da biblioteca (core + catalog_delta) para validação humana,
mantendo aqui a **cópia original exata** + **checksums SHA256** para detectar qualquer alteração indevida
(ID, nome, linhas removidas/adicionadas) quando os arquivos voltarem.

## 2. Arquivos enviados (6)
| Arquivo | Prioridade | Pacote | Linhas |
|---|---|---|---|
| `p1-core-human-review.csv` | P1 | core | 51 |
| `p2-core-human-review.csv` | P2 | core | 78 |
| `p3-core-human-review.csv` | P3 | core | 86 |
| `p1-catalog-delta-human-review.csv` | P1 | delta | 134 |
| `p2-catalog-delta-human-review.csv` | P2 | delta | 248 |
| `p3-catalog-delta-human-review.csv` | P3 | delta | 152 |

Total: **6 arquivos**, **749 linhas**. Checksums em `review-outbox-manifest.json` / `review-outbox-file-index.md`.

## 3. Ordem recomendada de revisão
1. `p1-core` 2. `p1-catalog-delta` 3. `p2-core` 4. `p2-catalog-delta` 5. `p3-core` 6. `p3-catalog-delta`.

## 4. Campos que NÃO podem ser editados
`exercise_id`, `exercise_name`, `muscle_group`, `max_priority`, `risk_regions`, `movement_patterns`,
`source_packages`.

## 5. Campos que podem ser editados
`suggested_contraindications`, `suggested_pain_limitation_tags`, `suggested_regressions`,
`suggested_equivalent_substitutes`, `suggested_progressions`, `suggested_equipment`, `reviewer_status`,
`reviewer_name`, `reviewed_at`, `reviewer_notes`, `approval_decision_reason`, `ready_for_upsert`.

## 6. Regras de status
- **`approved`** exige: `reviewer_name` + `reviewed_at` + `approval_decision_reason` + `ready_for_upsert=true`;
  substitutes/regressions **reais** (nunca inventar); conflitos/multi-região com `reviewer_notes`.
- **`rejected`** exige: `approval_decision_reason`; `ready_for_upsert` false/vazio.
- **`needs_more_info`** exige: `reviewer_notes`; `ready_for_upsert` false/vazio.

## 7. Como devolver
- Devolver os CSVs no **mesmo formato** (mesmas colunas/linhas, **sem** alterar IDs/nomes).
- **Não** renomear colunas; **não** apagar/adicionar linhas; **não** converter em PDF/print.
- Salvar os devolvidos em **pasta separada** (ex.: `review-inbox/`), **nunca** sobrescrevendo este outbox.

## 8. Confirmação
- **Nada foi aplicado no banco.**
- **Tudo `needs_review`** (0 approved; 0 `ready_for_upsert=true`).
- **Approved manifests vazios.**
- **Deploy / Flag ON / Cutover = NOT_AUTHORIZED.**
