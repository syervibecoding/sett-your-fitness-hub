# Checklist de Retorno — Revisão Humana P1 (Curadoria v1)

> **ORDEM 032.** Use este checklist quando o professor/curador **devolver** o arquivo revisado
> (`library-curation-v1-p1-human-review.csv`), **antes** de gerar qualquer approved manifest ou SQL.
> Tudo offline. **Nada é aplicado no banco aqui.**

## 1. Checklist antes de aceitar o arquivo de volta
- [ ] O arquivo é **CSV**.
- [ ] **Headers preservados** (mesmos nomes e ordem).
- [ ] **Número de linhas igual** ao enviado (**51** linhas de dados + header).
- [ ] **Nenhum `exercise_id` alterado**.
- [ ] **Nenhum `exercise_name` alterado**.
- [ ] `reviewer_status` usa **apenas** `approved` / `rejected` / `needs_more_info` / `needs_review`.
- [ ] `approved` tem **`reviewer_name`**.
- [ ] `approved` tem **`reviewed_at`**.
- [ ] `approved` tem **`approval_decision_reason`**.
- [ ] `approved` tem **`ready_for_upsert=true`**.
- [ ] `rejected` tem **motivo** (`approval_decision_reason`).
- [ ] `needs_more_info` tem **`reviewer_notes`**.
- [ ] `conflict_notes` preenchido exige **`reviewer_notes`** quando `approved`.
- [ ] Múltiplas `risk_regions` exigem **`reviewer_notes`** quando `approved`.

> Dica: a maioria desses itens é verificada automaticamente pelo validador (§2). O checklist manual
> cobre o que é visual (headers, contagem de linhas, ids/nomes intactos).

## 2. Comando de validação
```bash
node scripts/prescription/validate-curation-review-board.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p1-human-review.csv \
  --expect-priority P1 \
  --report docs/prescription/library-curation-v1-p1-human-review-validation-report.md
```

## 3. Comando para gerar approved manifest (após validação sem errors)
```bash
node scripts/prescription/build-approved-curation-manifest.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p1-human-review.csv \
  --expect-priority P1 \
  --out docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --report docs/prescription/library-curation-v1-approved-manifest-p1-report.md
```

## 4. Critério de aceite
- Validação **sem errors** (warnings de ambiguidade textual são aceitáveis).
- Approved manifest contém **apenas** `approved` + `ready_for_upsert=true`.
- **Nenhum** `substitute`/`regression`/`progression` desconhecido (claramente não-exercício).
- **Nenhuma** linha `applied`.
- **Nenhum** dado aplicado no banco ainda.

## 5. Próximo passo
- **Backup** de `exercise_metadata`.
- **Staging** (template SQL com `ROLLBACK`).
- **Upsert controlado** (só o approved manifest).
- **Reauditoria** (`bn-prescription-engine-v1-library-metadata-audit.sql`).
- **Nova aprovação ATENA** antes de produção.
