# Relatório do Delta de Catálogo (BN Prescription Engine v1)

> **ORDEM 043.** Consolida runtime coverage + freshness de curadoria após a entrada de muitos
> exercícios novos. **Nada aplicado no banco** (somente `SELECT` read-only).

## 1. Status final
**ACCEPT_WITH_NOTES.**
- **Runtime coverage = ACCEPT** (o motor considera todo o catálogo recebido).
- **Catalog delta curation = PREPARED** (534 fora do manifesto, pacote de revisão criado).
- Ressalvas: metadata vazia (0), 351 sem target primário, 232 sem equipment; edge `loadExerciseCatalog`
  com `.limit(700)` < 749 (BLOCKER de borda da Fase 40, fora do escopo).

## 2. Runtime coverage
- **O motor considera o catálogo recebido?** **SIM.** `generateTrainingProgram`→`normalizeCatalog`
  mantém todo exercício com `id`+`name`; `pickCatalogExercise` ranqueia o **catálogo inteiro**; o
  fallback de emergência da edge usa o catálogo real. (Confirmado na Fase 40 + testes.)
- **Há lista antiga/hardcoded problemática?** **Não** no engine/adapters/edge. O único limitador é o
  **`.limit(700)`** do `loadExerciseCatalog` (corte por volume, não por idade/lista) — latente agora que
  o total passou de 700 (749). Relatado na Fase 40 como BLOCKER de borda; **não** alterado aqui.
- **Novos exercícios entram no pool?** **SIM** — inclusive sem metadata (mantidos com gap/warning,
  nunca descartados silenciosamente).

## 3. Curation freshness
- **Fora do manifesto:** **534** (302 novos + 232 antigos não-curados).
- **Prioridade inferida (conservadora):** P1 **134** (alto risco/pliometria/overhead/hinge/agachamento),
  P2 **248**, P3 **152**.
- **Precisa review humano?** **SIM** — `catalog-delta-human-review.csv` (100% `needs_review`, nada aprovado).

## 4. Riscos
- **Metadata ausente:** 534/534 sem metadata → seleção por dor/restrição degrada para keywords.
- **Target primário ausente:** 351/534 → qualidade de seleção/volume por grupo reduzida.
- **Equipment ausente:** 232/534 → impacta treinos casa/halteres.
- **Substitutes/regressions ausentes:** não há substituto curado para os novos (deixados vazios; a
  revisão humana deve preencher com nomes reais).
- **`catalog_delta` pode AUMENTAR blockers** (`safe_alternative_unavailable`) se entrar em shadow real
  **sem** curadoria — por isso shadow real segue bloqueado.

## 5. Decisão
- **Runtime Catalog Coverage = ACCEPT**
- **Catalog Delta Curation = PREPARED**
- **Shadow real = NOT_AUTHORIZED** (metadata segue ruim/vazia)
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**

## 6. Artefatos desta ordem
- `library-curation-v1-catalog-delta.md` — resumo do delta.
- `library-curation-v1-catalog-delta.csv` — 534 linhas (raw + inferência).
- `library-curation-v1-catalog-delta-human-review.csv` — 534 linhas, 100% `needs_review`.
- `library-curation-v1-catalog-delta-integration-plan.md` — plano de integração.
- Testes de runtime coverage: `src/lib/prescription/catalog-coverage.test.ts` (Fase 40, 8 testes — confirmados passando).
