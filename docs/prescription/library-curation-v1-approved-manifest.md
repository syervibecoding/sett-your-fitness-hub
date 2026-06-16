# Approved Manifest da Curadoria (v1)

> **ORDEM 031.** Gerador **offline** do `approved_manifest` — o **único** arquivo que poderá virar base
> de upsert futuro. **Não conecta no banco, não executa SQL, não altera dados, não faz deploy.**

## 1. Objetivo
Produzir, a partir de um CSV de revisão humana, um arquivo contendo **somente** as linhas
**efetivamente aprovadas** (`reviewer_status=approved` **e** `ready_for_upsert=true`). Esse arquivo —
o **approved manifest** — é o **único** insumo autorizado a alimentar, no futuro, o template SQL de
upsert (`library-curation-v1-upsert-template.sql`). Nada fora dele pode ser aplicado.

## 2. Entrada
- **Consolidated manifest** (`library-curation-v1-consolidated-manifest.csv`) — fonte da verdade offline
  de `exercise_id`/`exercise_name` (215 linhas).
- **Review-board CSV** (ex.: `library-curation-v1-review-board-p1.csv`) — decisões humanas por linha.
- **Somente** linhas com `reviewer_status=approved` **e** `ready_for_upsert=true` entram na saída.
  `needs_review` / `rejected` / `needs_more_info` são puladas; `applied` é **erro** nesta fase.

## 3. Saída
- **Approved manifest CSV** (`--out`) com as colunas finais (sem o prefixo `suggested_`):
  `exercise_id, exercise_name, muscle_group, source_packages, risk_regions, movement_patterns,
  max_priority, contraindications, pain_limitation_tags, regressions, equivalent_substitutes,
  progressions, equipment, reviewer_name, reviewed_at, approval_decision_reason, reviewer_notes`.
- **Report markdown** (`--report`) com status + contagens + erros + warnings.
- **Quando o arquivo fica vazio:** se não houver linha aprovada, o CSV de saída contém **apenas o
  header** (status `NO_APPROVED_ROWS`). Se houver erros, o CSV **não** recebe dados (status
  `BLOCKED_BY_ERRORS`).

## 4. Regras de segurança
- `needs_review` **não entra**.
- `rejected` **não entra**.
- `needs_more_info` **não entra**.
- `applied` é **erro** nesta fase (só após execução controlada + reauditoria).
- `approved` exige `reviewer_name` + `reviewed_at` + `approval_decision_reason` + `ready_for_upsert=true`.
- Conflitos (`conflict_notes`, múltiplas `risk_regions`, múltiplos `source_packages`) exigem `reviewer_notes`.
- `equivalent_substitutes`/`regressions`/`progressions` precisam existir no manifesto (item claramente
  não-exercício = **erro**; item ausente/ambíguo = **warning**).
- **Não** inventa substitute/regression/progression; **não** preenche campo vazio automaticamente;
  **não** cria dado que não esteja no review CSV.

## 5. Como rodar
```bash
node scripts/prescription/build-approved-curation-manifest.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review   docs/prescription/library-curation-v1-review-board-p1.csv \
  --expect-priority P1 \
  --out      docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --report   docs/prescription/library-curation-v1-approved-manifest-p1-report.md
```
ESM puro, sem dependências externas (apenas `fs`/`path`/`process`).

## 6. Como interpretar o status
- **`NO_APPROVED_ROWS`** — nenhuma linha aprovada; CSV só com header; `exit 0`. **Nada a aplicar.**
- **`APPROVED_MANIFEST_READY`** — há linhas aprovadas e válidas; CSV com dados; `exit 0`. Pronto para a
  etapa de aplicação **futura** (ainda com backup/staging/reauditoria).
- **`BLOCKED_BY_ERRORS`** — há erros; CSV **sem** dados; `exit 1`. Corrigir o review e rodar de novo.

## 7. Próximo passo futuro
- **Somente** o approved manifest pode alimentar o template SQL.
- Ainda exige **backup** de `exercise_metadata`.
- **Staging primeiro** (rodar o template com `ROLLBACK`, validar).
- **Reauditoria depois** (`bn-prescription-engine-v1-library-metadata-audit.sql`).
- **Produção só com ordem explícita** (e rollback pronto).

## 8. Não fazer
- Não rodar upsert direto do review-board (use o approved manifest validado).
- Não aplicar `needs_review`.
- Não editar banco nesta etapa.
- Não ligar shadow/cutover.
- Não usar IA como aprovador clínico final.
