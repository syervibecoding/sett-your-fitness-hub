# Plano de Integração do Delta de Catálogo (Curadoria v1)

> **ORDEM 043.** Como integrar os **534** exercícios fora do manifesto ao pipeline de curadoria **sem
> mexer no banco**. Nada aplicado/aprovado nesta ordem.

## 1. Objetivo
Integrar os exercícios novos (e antigos não-curados) ao pipeline de curadoria existente, de forma
**aditiva, deduplicada e com revisão humana**, sem alterar o banco, o engine ou a edge.

## 2. Fluxo (mesmo pipeline já validado)
1. **Delta audit** (esta ordem) → `catalog-delta.csv` + `catalog-delta-human-review.csv` (100% `needs_review`).
2. **Human review** — professor/curador preenche o `catalog-delta-human-review.csv`.
3. **Return guard** (futuro) — `check-curation-review-return.mjs` (sent vs returned).
4. **Validator** (futuro) — `validate-curation-review-board.mjs --expect-priority any`.
5. **Approved manifest** (futuro) — `build-approved-curation-manifest.mjs` (só `approved` + `ready_for_upsert=true`).
6. **SQL no-op** (futuro) — `build-curation-upsert-sql.mjs --mode noop`.
7. **Staging somente com ordem ATENA** (e backup + reauditoria).

## 3. Como encaixar com P1/P2/P3
- O delta pode virar um **lote separado** (`source_packages = catalog_delta`) **ou** ser incorporado a
  uma **v2 do manifesto consolidado**.
- **Não misturar** com o manifesto v1 sem **deduplicação por `exercise_id`** (o delta já exclui os 215 do v1).
- **Não aprovar automaticamente** — toda linha passa por revisão humana.

## 4. Critério para integrar ao manifesto consolidado futuro (v2)
- `exercise_id`/`exercise_name` **reais**.
- `reviewer_status = approved`.
- **Validator sem erro**.
- `substitutes`/`regressions`/`progressions` **reais** (confirmados na biblioteca).
- **Sem `conflict_notes` pendentes**.
- **ATENA autoriza**.

## 5. Não fazer
- Não aplicar o delta direto no banco.
- Não rodar SQL com dados do delta (só no-op).
- **Não alterar o engine** para "forçar" o uso dos novos exercícios.
- **Não remover regras de segurança** (biblioteca-only, dor>3 trava, EVA>5 handoff, cap 12/16, sem método
  avançado indevido, substituição segura por padrão/músculo, regra mais conservadora vence) para escolher novos.
- Não ligar shadow/cutover por causa do delta.

## 6. Atenção especial: Performance/pliometria (98 itens)
Os exercícios `PERF` (saltos, depth/drop jumps, bounds, med ball, sprints, sled, wall drills) são
**high_skill/impact**: a curadoria deve marcar cautela, **sem semanas 1–2**, **gate por nível/dor**, e o
engine já bloqueia pliometria nas semanas 1–2 — **não** relaxar isso para acomodar os novos.
