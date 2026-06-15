# Worksheet de Curadoria — 20 Exercícios de Alto Risco (v1)

> **Pacote inicial de curadoria (ORDEM 024). NADA foi aplicado no banco.** Tudo aqui é **sugestão**
> (`reviewer_status = needs_review`) e precisa de **validação humana** (professor/curador) antes de virar dado.
> Planilha: `library-curation-high-risk-v1.csv`.

## 1. Objetivo do pacote
Preencher, com revisão humana, os metadados de **segurança e substituição** dos **20 exercícios de alto
risco** que a auditoria (ORDEM 021) encontrou **sem `contraindications`** — os primeiros a destravar o
`status_sugerido` do `audit.sql` (P1 do plano de curadoria). Composição dos 20:
- **12 desenvolvimentos de ombro** (overhead press).
- **1 combo** "Agachamento com Desenvolvimento Halteres" (joelho + ombro).
- **2 encolhimentos overhead** (trapézio).
- **5 levantamentos terra** (carga axial / lombar).

## 2. Origem dos dados (read-only)
- `exercise_id`/`exercise_name`/`muscle_group`: **reais**, vindos de `SELECT` em `exercise_library`.
- `suggested_regressions`/`suggested_equivalent_substitutes`: usam **somente nomes reais** existentes na
  biblioteca (buscados via `SELECT`: Elevação Lateral, Face Pull Corda, Manguito Externo, Desenvolvimento
  Máquina/Neutro Máquina/Unilateral Landmine, Encolhimento Halter/Smith, RDL Barra/Halteres, Elevação
  Pélvica, Extensão de Quadril Banco Romano, Perdigueiro). **Nenhum exercício/ID inventado.**
- `suggested_contraindications`/`suggested_pain_limitation_tags`: taxonomia padronizada do plano de
  curadoria (§4 do `...-library-curation-plan.md`), aplicada de forma **conservadora**.

## 3. Como revisar (colunas do CSV)
- `inferred_pattern`, `risk_reason`: contexto (por que entrou como alto risco).
- `suggested_*`: propostas a revisar/editar. Separadas por `; ` dentro da célula.
- `reviewer_status`: começa `needs_review`. O curador muda para `approved` / `edited` / `rejected`.
- `reviewer_notes`: observações do curador (e notas automáticas, ex.: variação em máquina pode ser a própria regressão).

**Critérios de aprovação humana:**
- A contraindication faz sentido clínico para o exercício? (na dúvida, manter conservadora).
- As pain tags cobrem a região de risco real?
- As regressões/substitutos são **mais seguros** e existem na biblioteca?
- `equipment` bate com o exercício?
- Só marcar `approved` o que um profissional valida — IA **não** decide clinicamente sozinha.

## 4. Métricas do pacote
- **Exercícios listados:** 20.
- **Com substituto real sugerido:** 20 (todos têm ≥1 candidato real na biblioteca).
- **`needs_review`:** 20 (100% — nada é definitivo).
- Nenhum `exercise_id` inventado; nenhum substituto fora da biblioteca.

## 5. Como aplicar no futuro (com segurança) — fora desta ordem
1. Curador revisa o CSV e ajusta `suggested_*` + marca `reviewer_status`.
2. Só as linhas `approved`/`edited` viram dados — via **upsert em `exercise_metadata`**
   (`contraindications`/`pain_limitation_tags`/`regressions`/`equivalent_substitutes`/`progressions`) e
   `UPDATE` em `exercise_library.equipment`. **Isso é uma ordem futura** (com backup/plano), **não fake**.
3. Rodar o `audit.sql` **antes e depois** e comparar o `status_sugerido` (bloco 7) + `safe_alternative_unavailable`.
4. Repetir para os Lotes B–E do plano de curadoria.

## 6. Não fazer
- Não aplicar o CSV no banco sem revisão humana + plano/backup.
- Não tratar as sugestões como verdade clínica.
- Não inventar exercícios/IDs ou substitutos inexistentes.
- Não ligar shadow de paridade só porque os 20 foram taggeados — ver thresholds completos no plano (§7).
