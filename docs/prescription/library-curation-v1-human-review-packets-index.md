# Índice dos Pacotes de Revisão Humana — Curadoria da Biblioteca (v1)

> **ORDEM 034.** Índice dos pacotes P1/P2/P3 prontos para revisão humana. **Nada foi aplicado no
> banco.** Nenhuma linha aprovada; todos os approved manifests estão **vazios/só header**.

## 1. Resumo executivo
- **P1, P2 e P3 preparados** para revisão humana (offline).
- **Nenhum `approved`** ainda — todos os pacotes 100% `needs_review`.
- **Approved manifests vazios** (só header) para P1, P2 e P3.
- **Banco intocado.**

## 2. Pacotes disponíveis
| Prioridade | Arquivo de revisão | Linhas | Validation report | Approved manifest | Approved report | Status |
|---|---|---|---|---|---|---|
| **P1** | `library-curation-v1-p1-human-review.csv` | 51 | `library-curation-v1-p1-human-review-validation-report.md` | `library-curation-v1-approved-manifest-p1.csv` | `library-curation-v1-approved-manifest-p1-report.md` | 100% needs_review |
| **P2** | `library-curation-v1-p2-human-review.csv` | 78 | `library-curation-v1-p2-human-review-validation-report.md` | `library-curation-v1-approved-manifest-p2.csv` | `library-curation-v1-approved-manifest-p2-report.md` | 100% needs_review |
| **P3** | `library-curation-v1-p3-human-review.csv` | 86 | `library-curation-v1-p3-human-review-validation-report.md` | `library-curation-v1-approved-manifest-p3.csv` | `library-curation-v1-approved-manifest-p3-report.md` | 100% needs_review |

Total: **215** exercícios (51 + 78 + 86), todos `needs_review`.

## 3. Ordem recomendada de revisão
1. **P1** primeiro (maior risco operacional — overhead, hinge carregado, carga axial, joelho profundo, multi-região).
2. **P2** depois (compostos moderados).
3. **P3** por último (isolados/acessórios/opções seguras).

## 4. Como validar arquivo devolvido
```bash
# P1
node scripts/prescription/validate-curation-review-board.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p1-human-review.csv \
  --expect-priority P1 \
  --report docs/prescription/library-curation-v1-p1-human-review-validation-report.md

# P2
node scripts/prescription/validate-curation-review-board.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p2-human-review.csv \
  --expect-priority P2 \
  --report docs/prescription/library-curation-v1-p2-human-review-validation-report.md

# P3
node scripts/prescription/validate-curation-review-board.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p3-human-review.csv \
  --expect-priority P3 \
  --report docs/prescription/library-curation-v1-p3-human-review-validation-report.md
```

## 5. Como gerar approved manifest após revisão
```bash
# P1
node scripts/prescription/build-approved-curation-manifest.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p1-human-review.csv \
  --expect-priority P1 \
  --out docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --report docs/prescription/library-curation-v1-approved-manifest-p1-report.md

# P2
node scripts/prescription/build-approved-curation-manifest.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p2-human-review.csv \
  --expect-priority P2 \
  --out docs/prescription/library-curation-v1-approved-manifest-p2.csv \
  --report docs/prescription/library-curation-v1-approved-manifest-p2-report.md

# P3
node scripts/prescription/build-approved-curation-manifest.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p3-human-review.csv \
  --expect-priority P3 \
  --out docs/prescription/library-curation-v1-approved-manifest-p3.csv \
  --report docs/prescription/library-curation-v1-approved-manifest-p3-report.md
```

## 6. Critérios de aceite
- Validator **sem errors** (warnings de ambiguidade textual são aceitáveis).
- Approved manifest **só** com `approved` + `ready_for_upsert=true`.
- `substitutes`/`regressions`/`progressions` reais (nada claramente inexistente).
- `reviewer_name` / `reviewed_at` / `approval_decision_reason` preenchidos nos `approved`.
- **Nada** `applied`.
- **Banco ainda intocado.**

## 7. Não fazer
- Não aplicar `needs_review`.
- Não aplicar CSV bruto.
- Não rodar upsert sem approved manifest.
- Não ligar shadow/cutover.
- Não fazer deploy.
- Não usar IA como aprovador clínico final.

## 8. Status
- **Human Review Packets = PREPARED**
- **Banco = UNCHANGED**
- **Approved manifests = EMPTY**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
