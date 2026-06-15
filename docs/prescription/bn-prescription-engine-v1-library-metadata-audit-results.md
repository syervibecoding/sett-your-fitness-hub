# BN Prescription Engine v1 — Resultados da Auditoria de Metadados da Biblioteca

## 1. Resumo executivo

**Status: `BLOCKED_FOR_SHADOW`**

A biblioteca tem **boa cobertura ESTRUTURAL** (447 exercícios, 100% com `muscle_group` e `difficulty`,
85% com target primário, 836 linhas de `exercise_muscle_targets`, todos os 9 padrões de movimento
presentes), mas **zero cobertura de metadados de segurança/substituição**: a tabela `exercise_metadata`
está **vazia (0 linhas)** → 100% dos exercícios sem `contraindications`, `pain_limitation_tags`,
`equivalent_substitutes`, `regressions`, `progressions`. Além disso, `equipment` está **ausente em 100%**.
Há **20 exercícios de alto risco** (desenvolvimentos/overhead, levantamento terra) **sem contraindications**.
Impacto no engine: a segurança/substituição cai para heurística por **nome** (que existe e funciona como
rede), mas sem os bans/alternativas curados a comparação engine × fallback no shadow seria **injusta e
diagnóstica**, não conclusiva. **Não seguir para shadow de avaliação** antes da curadoria; um shadow
**apenas diagnóstico** é admissível para baselining (ver §12).

## 2. Ambiente auditado
- **Data:** 2026-06-15 (auditoria read-only).
- **Base:** projeto Supabase **`zshrcgbyhzxpnlccssyz`** (Bn-app).
- **SQL usado:** `docs/prescription/bn-prescription-engine-v1-library-metadata-audit.sql` (commit ref **`3a6f433`**).
- **Read-only confirmado:** verificado que o `.sql` só contém `with`/`select`/comentários (nenhuma keyword
  de escrita/DDL fora de comentário). Execução: somente `SELECT`. **Nenhum dado alterado.**

## 3. Cobertura geral
| Métrica | Valor |
|---|---|
| Total de exercícios | **447** |
| Com `muscle_group` (texto) | 447 (100%) |
| Sem `muscle_group` | **0** |
| Com target primário (`is_primary`) | 381 (85,2%) |
| Sem target primário | **66 (14,8%)** |
| Com linha em `exercise_metadata` | 0 |
| Sem `exercise_metadata` | **447 (100%)** |
| Com `difficulty` | 447 (100%) |
| Sem `difficulty` | 0 |
| Com `equipment` | 0 |
| Sem `equipment` | **447 (100%)** |
| (linhas de `exercise_muscle_targets`) | 836 |

## 4. Segurança
| Métrica | Valor |
|---|---|
| Sem `contraindications` | **447 (100%)** |
| Sem `pain_limitation_tags` | **447 (100%)** |
| Alto risco sem `contraindications` | **20** |
| Relevantes a **joelho** sem pain tags | 54 |
| Relevantes a **lombar** sem pain tags | 46 |
| Relevantes a **ombro** sem pain tags | 100 |

## 5. Substituição
| Métrica | Valor |
|---|---|
| Sem `equivalent_substitutes` | **447 (100%)** |
| Sem `regressions` | **447 (100%)** |
| Sem `progressions` | **447 (100%)** |
| Padrões essenciais com **< 3 alternativas seguras** | **5 de 5** (joelho_dominante, quadril_dominante, empurrar_horizontal, puxar_horizontal, puxar_vertical — 0 seguras cada) |
| Risco estimado de `safe_alternative_unavailable` | **Moderado** — a seleção por keyword acha exercícios (mitiga blocker), mas **sem** ban/substituto curado a qualidade cai |

## 6. Padrões de movimento
| Padrão | Total | C/ metadado segurança | C/ substitute/regression | Status |
|---|---|---|---|---|
| isolado_acessorio | 144 | 0 | 0 | CRÍTICO (metadados) |
| joelho_dominante | 52 | 0 | 0 | CRÍTICO |
| empurrar_vertical | 51 | 0 | 0 | CRÍTICO |
| core | 43 | 0 | 0 | CRÍTICO |
| quadril_dominante | 42 | 0 | 0 | CRÍTICO |
| empurrar_horizontal | 42 | 0 | 0 | CRÍTICO |
| puxar_horizontal | 34 | 0 | 0 | CRÍTICO |
| unilateral | 22 | 0 | 0 | CRÍTICO |
| puxar_vertical | 17 | 0 | 0 | CRÍTICO |

> **Estrutura por padrão é boa** (todos ≥17 exercícios), mas **cobertura de metadados = 0** em todos →
> "CRÍTICO" é quanto a metadados, não quanto à quantidade de exercícios.

## 7. Equipamentos
| Bucket | Valor |
|---|---|
| Academia completa | 0 |
| Halteres | 0 |
| Casa mínimo/elástico | 0 |
| Máquinas | 0 |
| Cabos | 0 |
| Peso corporal | 0 |
| **Ausente** | **447 (100%)** |

> `exercise_library.equipment` nunca foi preenchido. (Lembrete: o `loadExerciseCatalog` da edge **nem
> seleciona** `equipment` hoje — gap de B3 a corrigir no wiring.)

## 8. Regiões de risco
| Região | Relevantes | C/ contraindications | C/ pain tags | C/ substitutes |
|---|---|---|---|---|
| **joelho** | 54 | 0 | 0 | 0 |
| **lombar** | 51 | 0 | 0 | 0 |
| **ombro** | 100 | 0 | 0 | 0 |

**Risco para prescrição:** nas três regiões, **nenhum** exercício tem tag de cautela, contraindicação ou
substituto curado. O engine ainda protege via regras por **nome/grupo** (avoidKeywords/preferKeywords e
remoção de padrão em dor severa), mas **sem** a camada de metadados → menor precisão de ban/substituição.

## 9. Veredito dos thresholds (critérios da ORDEM 020)
| Critério | Resultado | Dispara? |
|---|---|---|
| > 20% sem target primário | 14,8% | Não |
| Algum alto risco sem `contraindications` | 20 | **SIM → BLOCKED_FOR_SHADOW** |
| Algum padrão essencial com < 3 seguros | 5/5 | **SIM → BLOCKED_FOR_SHADOW** |
| `equipment` ausente > 30% | 100% | (seria ACCEPT_WITH_NOTES; sobreposto por BLOCKED) |

**Veredito: `BLOCKED_FOR_SHADOW`** (dois gatilhos).
> ✅ **Bloco 7 do `.sql` corrigido na ORDEM 022:** a contagem de "padrões essenciais com <3 seguros" virou
> CTE (`essential_below_3`) reduzida por um `count(*)` externo (escalar). O bloco agora **retorna 1 linha**
> e foi validado read-only: `total_exercises=447, pct_without_primary_target=14.8,
> high_risk_without_contraindications=20, essential_patterns_below_3_safe=5, pct_without_equipment=100.0,
> status_sugerido=BLOCKED_FOR_SHADOW` — confirmando o veredito que havia sido computado manualmente.

## 10. Top 20 correções recomendadas (curadoria — sem editar dados aqui)
**Prioridade 1 — segurança (alto risco sem contraindications + pain tags):** popular `contraindications` e
`pain_limitation_tags` nos **20 de alto risco** já identificados:
- 13 desenvolvimentos de ombro (Arnold em pé/sentado, Barra sentado, Halteres em pé/sentado, Máquina,
  Militar, Neutro em pé/halteres/máquina, Sentado Smith, Unilateral Landmine);
- 2 Encolhimento Overhead (Barra, Smith);
- 5 Levantamento Terra (convencional, Sumô, Sumô Belt Squat, Sumô com Halter, Sumô Landmine).
- Em seguida, as regiões de risco: **joelho (54)**, **lombar (51)**, **ombro (100)** — pelo menos os
  compostos e os de maior carga axial/articular.

**Prioridade 2 — substituição/alternativa segura:** garantir ≥3 exercícios "seguros" por padrão essencial
e preencher `equivalent_substitutes`/`regressions` nos compostos (agachamento, leg press, hip thrust/RDL,
remada, puxada, supino).

**Prioridade 3 — completude:** preencher `equipment` (447) e `difficulty` onde fizer sentido; resolver os
**66** exercícios sem target primário (`is_primary`).

## 11. Impacto no shadow mode
- **Risco de blockers (`safe_alternative_unavailable`):** moderado — a seleção por keyword normalmente
  acha um exercício (447 itens, nomes ricos), então o blocker tende a NÃO disparar muito; mas onde a única
  opção de um padrão for contraindicada pelo nome, dispara.
- **Risco de planos incompletos:** baixo-moderado — o engine preenche, mas sem `regressions`/`progressions`
  curados (usa textos de fallback) e sem substitutos curados.
- **Risco de comparação injusta engine × fallback:** **alto** — nenhum dos dois tem metadados; a comparação
  mediria sobretudo diferenças de split/volume, não a vantagem real do engine (ban/substituição por metadados).
- **Conclusão:** **shadow não deve ser usado para JULGAR paridade/cutover** agora. Pode rodar **só para
  diagnóstico** (baselining do gap), pois nunca afeta o aluno — mas isso exige antes o deploy da edge +
  `deno check` (ambos pendentes/condicionados a ordem).

## 12. Decisão
- **Library Metadata Readiness = `BLOCKED_FOR_SHADOW`**
- **Shadow real = `AUTHORIZED_FOR_DIAGNOSTIC_ONLY`** — admissível apenas para coletar baseline do gap
  (seguro, off por default), **condicionado** a: `deno check` da edge + deploy sob ordem explícita.
  **Não** vale para avaliação de paridade nem cutover enquanto a metadata não for curada.
- **Deploy = `NOT_AUTHORIZED`**
- **Flag ON = `NOT_AUTHORIZED`**

## 13. Próximos passos
1. **Curadoria de metadados** (maior alavanca): popular `exercise_metadata` — começar pelos 20 de alto
   risco (P1), depois joelho/lombar/ombro, depois substitutos/regressions dos compostos. **É curadoria de
   DADOS, não migration de schema** (`exercise_metadata` já existe). Deve ser uma **ordem futura com plano
   aprovado** (seed/curadoria revisada — não fake).
2. **Preencher `equipment`** (447) + **estender o `select` do `loadExerciseCatalog`** para trazer
   `equipment`/`difficulty` (gap B3) — ordem futura.
3. **Evoluir o `.sql`:** bloco 7 (subquery escalar) — ✅ **corrigido na ORDEM 022** (retorna 1 linha; validado).
4. **Runbook de shadow:** pode ser **preparado** (documento) agora, mas a **execução real** do shadow deve
   **aguardar a curadoria** (ou rodar estritamente em modo diagnóstico). Não ligar flag/deploy sem ordem.
