# Protocolo de Retorno — Revisão Humana da Curadoria (v1)

> **ORDEM 035.** Passo a passo para a ATENA processar os CSVs revisados que voltarem do
> professor/curador. **Tudo offline.** Nenhuma escrita no banco nesta etapa.

## 1. Ao receber o CSV revisado
- **Salvar uma cópia original** do arquivo recebido (sem editar), com data/origem.
- **Não editar manualmente** antes de validar.
- **Confirmar a prioridade** (P1/P2/P3) do arquivo.
- **Confirmar o número de linhas** (P1=51, P2=78, P3=86 linhas de dados).
- **Confirmar os headers** (mesmos nomes e ordem do CSV enviado).

## 2. Rodar validação offline
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

## 3. Gerar approved manifest
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

## 4. Critério de aceite
- Validator **`errors = 0`**.
- Approved manifest contém **apenas** `approved` + `ready_for_upsert=true`.
- Cada `approved` tem `reviewer_name` / `reviewed_at` / `approval_decision_reason`.
- **Nenhum** `substitute`/`regression`/`progression` desconhecido (claramente inexistente).
- **Nenhuma** linha `applied`.
- **Banco ainda intocado.**

## 5. Se houver erro
- **Não corrigir no banco.**
- **Devolver para o revisor** ou corrigir no CSV **com rastreabilidade** (registrar o que mudou e por quê).
- **Revalidar** (voltar ao passo 2).

## 6. Se houver warning
- **Revisar manualmente** (especialmente substitutos fora do manifesto e cues de texto livre).
- Decidir se a linha precisa voltar para **`needs_more_info`**.
- **Registrar `reviewer_notes`** com a decisão.

## 7. Próximo passo após approved manifest válido
- **Backup** de `exercise_metadata`.
- **Staging** (template SQL com `ROLLBACK`).
- **Upsert controlado** (só o approved manifest).
- **Reauditoria** (`bn-prescription-engine-v1-library-metadata-audit.sql`).
- **Aprovação ATENA** antes de qualquer produção.
