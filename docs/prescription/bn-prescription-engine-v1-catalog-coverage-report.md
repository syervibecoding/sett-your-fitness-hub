# Relatório de Cobertura do Catálogo (BN Prescription Engine v1)

> **ORDEM 040.** Garante que o engine, os adapters e o fluxo futuro da edge consideram **todos** os
> exercícios do catálogo atual (pool de candidatos) — não presos a lista antiga/hardcoded. **Nada foi
> aplicado no banco.**

## 1. Resumo executivo
**Status: ACCEPT_WITH_NOTES.**
- **Runtime do motor (engine + adapters): ACCEPT.** Consideram todo o catálogo recebido; nenhum exercício
  antigo/hardcoded; exercícios novos sem metadata **permanecem** no pool (não somem).
- **Ressalva (NOTE → BLOCKER de borda):** a edge `loadExerciseCatalog` tem **`.limit(700)`** e o catálogo
  já tem **749**; ~49 exercícios podem ser cortados **antes** de chegar ao engine. Isso **não** é um problema
  do engine, mas do carregamento na edge — e corrigir a edge está **fora do escopo** desta ordem.
- **Curadoria (metadata): BLOCKED** — `exercise_metadata` está vazia (0); 534 exercícios (incl. 302 novos)
  fora do manifesto. Shadow real continua `NOT_AUTHORIZED`.

## 2. Garantia principal
- **"O motor considera todos os exercícios recebidos no catálogo atual?"** → **SIM.** `generateTrainingProgram`
  → `normalizeCatalog` mantém todo exercício com `id`+`name`; `pickCatalogExercise` ranqueia o **catálogo
  inteiro**. O fallback de emergência da edge (`buildEmergencyFallbackPlan`/`fallbackExercise`) também
  seleciona do **catálogo real** (`pickCatalogExercise(catalog,…)`), não de lista estática.
- **"O fluxo tem algum ponto preso a lista antiga?"** → **Não há lista antiga/hardcoded** no engine/adapters/edge.
  O **único** ponto que limita o conjunto é o **`.limit(700)`** do `loadExerciseCatalog` (corte por volume,
  não por idade/nome/metadata) — vira problema agora que o total passou de 700.
- **"Novos exercícios sem metadata somem ou entram como gaps?"** → **Entram como candidatos**; o adapter os
  mantém com `contraindications/pain_limitation_tags = []` e **registra** `no_safety_metadata:N` em warnings
  (rastreável). Não somem silenciosamente.

## 3. Auditoria de código
| Arquivo | Ponto verificado | Resultado | Risco | Ação |
|---|---|---|---|---|
| `ai-prescribe-workout/index.ts` | `loadExerciseCatalog` filtro | `is_global OR company_id` (multi-tenant); **sem** filtro por data/nome/metadata | OK | — |
| `ai-prescribe-workout/index.ts` | `loadExerciseCatalog` `.limit(700)` | **Corta** o catálogo em 700 linhas; total atual **749** | **ALTO** | **BLOCKER** (subir/remover limite ou paginar — fora do escopo) |
| `ai-prescribe-workout/index.ts` | `select(...)` colunas | **não** traz `equipment`/`difficulty` | MÉDIO | NOTE (gap já sinalizado pelo adapter; impacta casa/halteres) |
| `ai-prescribe-workout/index.ts` | `buildEmergencyFallbackPlan`/`fallbackExercise` | usa `pickCatalogExercise(catalog,…)` (catálogo real) | OK | — |
| `ai-prescribe-workout/index.ts` | lista estática de exercícios | **não existe** (linha 1024 é texto de prompt) | OK | — |
| `_shared/prescription/adapters/catalogAdapter.ts` | descarte | só descarta **sem id/name**; mantém o resto | OK | — |
| `_shared/prescription/adapters/catalogAdapter.ts` | sem metadata | mantém no catálogo; warning `no_safety_metadata` | OK | — |
| `_shared/prescription/adapters/catalogAdapter.ts` | preserva id/name reais | sim | OK | — |
| `_shared/prescription/engine.ts` | `normalizeCatalog` + `pickCatalogExercise` | itera catálogo recebido; sem lista fixa | OK | — |
| `_shared/prescription/exerciseScoring.ts` | seleção | ranqueia todo o catálogo; exercício sem metadata é pontuado por keywords | OK | — |
| `src/lib/prescription/**` | shims/tests | re-exports; testes usam mocks, **não** dependem de lista fixa | OK | — |

## 4. Auditoria da biblioteca
| Métrica | Valor |
|---|---|
| Total atual | **749** |
| Baseline anterior | 447 |
| **Delta** | **+302** (todos `created_at >= 2026-06-16`) |
| Fora do manifesto (215) | **534** |
| Sem metadata | **749** (100%) |
| Sem target primário | **368** |
| Sem equipment | **447** |
| Precisa curadoria (fora do manifesto) | **534** |

## 5. Testes adicionados
`src/lib/prescription/catalog-coverage.test.ts` (8 testes, todos PASS):
- **1/2** adapter preserva exercício novo com `id` desconhecido (não depende de snapshot antigo).
- **3/8** adapter não descarta por falta de metadata; emite `no_safety_metadata` (rastreável).
- **7** exercício novo com metadata completa preserva tags/regressões.
- **10** catálogo 460 (≈447+N) aceito por inteiro, nada descartado.
- descarta **apenas** linhas sem id/name (não inventa).
- **4/5/6** engine usa **somente** ids do catálogo recebido e usa de fato ids `new_exercise_catalog_*` (sem fallback antigo).
- **4** exercício novo entra quando é o único candidato do grupo.
- catálogo vazio **não** inventa exercício (0 ids).

## 6. Riscos
- Novos exercícios **sem metadata** podem não ser priorizados por dor/restrição (ban degrada para keywords).
- Novos exercícios **sem target primário** (368) reduzem qualidade de seleção/volume por grupo.
- **Equipment ausente** (447) impacta treinos casa/halteres e o `loadExerciseCatalog` nem traz a coluna.
- Se `loadExerciseCatalog` **não** trouxer todos os campos (equipment/difficulty), o **B3** já sinaliza gap;
  precisa ajuste futuro da edge.
- **`.limit(700)` com 749**: a edge pode **não** enviar todos os exercícios ao engine → maior risco desta ordem.
- Manifestos/worksheets de curadoria **desatualizados**: 534 exercícios fora (incl. 302 novos de pliometria).

## 7. Decisão
- **Catalog Runtime Coverage = ACCEPT** (engine/adapters consideram todo o catálogo recebido).
- **Edge Catalog Loading = BLOCKED** (`.limit(700)` < 749; corrigir é fora do escopo → ORDEM futura).
- **Curation Manifest Freshness = BLOCKED** (534 fora do manifesto; metadata vazia).
- **Shadow real = NOT_AUTHORIZED** (metadata continua ruim).
- **Deploy = NOT_AUTHORIZED.**
- **Flag ON = NOT_AUTHORIZED.**
- **Cutover = NOT_AUTHORIZED.**

## 8. Próxima ação recomendada
1. **ORDEM futura (edge):** elevar/remover o `.limit(700)` do `loadExerciseCatalog` (ou paginar) e incluir
   `equipment`/`difficulty` no `select` — com aprovação, pois muda comportamento da edge.
2. **ORDEM futura (curadoria delta):** gerar pacote de curadoria dos **534** exercícios fora do manifesto
   (com atenção especial à pliometria/Performance: `high_skill/impact`, sem semanas 1–2), via o mesmo
   pipeline (worksheets → manifesto → review board → approved → upsert template). **Não aplicar dados ainda.**
