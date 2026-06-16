# Manifesto Consolidado de Curadoria da Biblioteca (v1)

> **Pacote de curadoria (ORDEM 027). NADA foi aplicado no banco.** Tudo é **sugestão**
> (`reviewer_status = needs_review`) e exige **validação humana** (professor/curador).
> Planilha: `library-curation-v1-consolidated-manifest.csv` (215 linhas de dados).

## 1. Objetivo e escopo
Unir os **3 pacotes de curadoria** produzidos nas ORDENS 024/025/026 em **um único manifesto
deduplicado**, com **uma linha por `exercise_id`**, para o curador revisar em um só lugar antes de
qualquer aplicação. Fontes consolidadas:

- `library-curation-high-risk-v1.csv` — **20** exercícios de alto risco (→ `high_risk`, prioridade P1).
- `library-curation-movement-pattern-minimum-safe-v1.csv` — **27** candidatos seguros por padrão
  (→ `movement_pattern_minimum`, prioridade base P3).
- `library-curation-risk-regions-v1.csv` — **205** linhas / **203** ids relevantes a joelho/lombar/ombro
  (→ `risk_regions`, prioridade da própria planilha P1/P2/P3).

Nenhum dado novo foi inventado: o manifesto é estritamente a **união** dos exercícios reais já
presentes nos três pacotes (todos obtidos por `SELECT` read-only na `exercise_library`).

## 2. Metodologia de consolidação (regras de merge)
Para cada `exercise_id` único:

1. **Dedup por id** — múltiplas aparições viram **uma linha**; `source_packages` lista os pacotes de origem.
2. **`max_priority`** = a mais alta entre os pacotes, na ordem **P1 > P2 > P3** (alto risco domina).
3. **União de metadados sugeridos** — `suggested_contraindications`, `suggested_pain_limitation_tags`,
   `suggested_regressions`, `suggested_equivalent_substitutes`, `suggested_progressions`,
   `suggested_equipment`, `movement_patterns`, `risk_regions` são a **união** das sugestões dos pacotes.
4. **Apenas nomes/IDs reais** nas colunas finais de substituto/regressão. Qualquer sugestão **sem
   exercício real confirmado** na biblioteca foi **removida** dessas colunas e **registrada em
   `conflict_notes`** (ver §5). Nada foi inventado.
5. **`conflict_notes`** sinaliza sobreposições e pontos de atenção para o revisor (ver §5).
6. **`reviewer_status` = `needs_review`** em **todas** as linhas; nenhuma foi marcada `approved`.

## 3. Resumo quantitativo
| Métrica | Valor |
|---|---|
| Exercícios únicos (linhas de dados) | **215** |
| **P1** (alto risco) | **51** |
| **P2** (composto moderado) | **78** |
| **P3** (isolado/acessório/opção segura) | **86** |
| Em **≥2 pacotes** (multi-source) | **32** |
| Origem `high_risk` | **20** |
| Origem `risk_regions` | **203** |
| Origem `movement_pattern_minimum` | **27** |
| Com região de risco anotada | **212** |
| Multi-região (≥2 regiões) | **16** |
| Linhas com `conflict_notes` preenchido | **24** |
| Linhas com **substituto real** sugerido | **215 (100%)** |
| `reviewer_status = needs_review` | **215 (100%)** |
| Sugestões não-reais movidas p/ `conflict_notes` | **5** |

## 4. Schema das colunas (CSV)
`exercise_id, exercise_name, muscle_group, source_packages, risk_regions, movement_patterns,
max_priority, suggested_contraindications, suggested_pain_limitation_tags, suggested_regressions,
suggested_equivalent_substitutes, suggested_progressions, suggested_equipment, conflict_notes,
reviewer_status, reviewer_notes`

- `source_packages`: `high_risk` / `risk_regions` / `movement_pattern_minimum` (1 a 3, separados por `; `).
- `risk_regions`: `knee` / `low_back` / `shoulder` (mapeadas de joelho/lombar/ombro), múltiplas por `; `.
- `max_priority`: `P1` > `P2` > `P3`.
- Colunas `suggested_*`: listas separadas por `; ` — **apenas exercícios/tags reais**.
- `reviewer_status`: sempre `needs_review` neste pacote.

## 5. Conflitos e sugestões não-reais (regras 4/5)
`conflict_notes` foi preenchido em **24** linhas, cobrindo:
- exercício que aparece como **alto risco** e também como **candidato seguro** (revisar com cautela);
- **multi-região** de risco (≥2 entre joelho/lombar/ombro);
- P1 **sem** contraindication sugerida (não houve nenhum: 0);
- **sem substituto real** (não houve nenhum: 0);
- **sugestão sem exercício real confirmado**, removida da coluna de substituto/regressão e anotada aqui.

**As 5 sugestões não-reais** (textos descritivos da worksheet de padrão, confirmados **inexistentes**
na `exercise_library` via `SELECT`) foram **retiradas** das colunas finais e movidas para `conflict_notes`:

| Exercício | Sugestão não-real movida p/ `conflict_notes` |
|---|---|
| Graviton Neutro | `(já assistido — regressão da barra)` |
| Prancha Frontal | `Prancha Alta (joelhos apoiados)` |
| Prancha Lateral | `Prancha Lateral com joelhos apoiados` |
| Perdigueiro Alternado | `(corretivo leve — base)` |
| Step Up Halteres | `(reduzir altura do step)` |

> Observação: são **regressões corretivas/instruções**, não exercícios catalogados. Cabe ao curador
> decidir se cadastra um exercício real equivalente ou trata como instrução de execução.

## 6. Validações (10) — PASS/FAIL
| # | Validação | Resultado |
|---|---|---|
| 1 | **Uma linha por `exercise_id`** (sem duplicatas) — 215 ids distintos = 215 linhas | **PASS** |
| 2 | **Todos os `exercise_id` existem** na `exercise_library` — `SELECT`: 215/215 | **PASS** |
| 3 | **`exercise_name` real** (vieram dos 3 pacotes, obtidos por `SELECT`) | **PASS** |
| 4 | **Nenhum `suggested_equivalent_substitutes` inventado** (5 não-reais → `conflict_notes`; resto confirmado) | **PASS** |
| 5 | **Nenhum `suggested_regressions` inventado** (idem regra 4) | **PASS** |
| 6 | **`max_priority` deduzido** corretamente (P1>P2>P3): 51 / 78 / 86 | **PASS** |
| 7 | **`source_packages`** reflete a origem real (high_risk 20 / risk_regions 203 / movement_pattern_minimum 27) | **PASS** |
| 8 | **`conflict_notes`** preenchido nas sobreposições/multi-região/sugestão-não-real (24 linhas) | **PASS** |
| 9 | **Todos `reviewer_status = needs_review`**; nenhum `approved/edited/rejected` (0) | **PASS** |
| 10 | **Nada aplicado no banco** — somente `SELECT` read-only; CSV/MD gerados localmente | **PASS** |

**Resultado: 10/10 PASS.**

## 7. Próximo passo e confirmação de não-alteração
1. Curador revisa o CSV consolidado por `max_priority` (P1 → P2 → P3), conferindo tags,
   contraindications, substitutos reais e `conflict_notes`, e marca `approved`/`edited`/`rejected`.
2. Resolver as **5** sugestões não-reais (cadastrar exercício equivalente real **ou** tratar como
   instrução de execução).
3. Aplicar **somente o aprovado** via upsert em `exercise_metadata` (+ `equipment` em
   `exercise_library`) — **ordem futura, com backup/plano**, nunca dado fake.
4. Rodar `library-metadata-audit.sql` (bloco 7) antes/depois — metas: `high_risk_without_contraindications = 0`
   e `essential_patterns_below_3_safe = 0` para derrubar `BLOCKED_FOR_SHADOW`.

**Confirmação:** este pacote usou **apenas `SELECT` read-only** (via conector) para validar ids/nomes;
o CSV e este MD foram gerados **localmente**. **Sem** INSERT/UPDATE/DELETE, migration, alteração de
engine/edge/UI, deploy ou mudança de flag. Todas as linhas permanecem `needs_review`.
