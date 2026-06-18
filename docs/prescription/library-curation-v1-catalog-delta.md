# Delta de Catálogo da Curadoria (BN Prescription Engine v1)

> **ORDEM 043.** Identifica exercícios que existem **hoje** na `exercise_library` mas **não** estão no
> manifesto consolidado nem nos pacotes humanos P1/P2/P3. **Nada foi aplicado no banco** (somente
> `SELECT` read-only + geração local de CSV/MD).

## 1. Resumo executivo
- **Total atual de exercícios:** **749**
- **Baseline anterior (ORDEM 021):** **447**
- **Delta atual (vs baseline):** **+302** (todos `created_at ≥ 2026-06-16`)
- **Fora do manifesto consolidado (215):** **534**
- **Precisam curadoria:** **534** (`needs_curation = true` para todos)
- **Status: `DELTA_FOUND`**

> O delta (534) é maior que os 302 novos porque o manifesto v1 curou apenas **215** dos 447 antigos —
> sobram **232 antigos não-curados** + **302 novos** = **534** fora do manifesto.

## 2. O que significa delta
- Exercícios novos (e antigos não-curados) **existem na biblioteca** e o **runtime já os considera** no
  catálogo (pool de candidatos) — confirmado na Fase 40 (`...-catalog-coverage-report.md`).
- A **curadoria está desatualizada**: o manifesto v1 cobre 215; faltam 534.
- **Sem metadata**, esses exercícios podem gerar **gaps/warnings** e seleção **menos segura** (ban por
  dor/lesão degrada para keywords; sem substituto curado).

## 3. Impacto na prescrição
- O motor **deve considerar todos** os exercícios recebidos no catálogo (pool) — e considera (Fase 40 = ACCEPT).
- Exercícios novos **sem metadata não somem** silenciosamente: o adapter os mantém e **registra gap/warning**.
- Exercícios novos podem precisar de **target primário, equipment, contraindications, pain tags e
  substitutes/regressions** para seleção segura por dor/restrição.
- **Shadow real de paridade continua BLOQUEADO** enquanto a metadata estiver ruim (`exercise_metadata` vazia).

## 4. Resultado por categoria (within os 534 fora do manifesto)
| Métrica | Valor |
|---|---|
| Total fora do manifesto | **534** |
| Com target primário | 183 |
| Sem target primário | **351** |
| Com metadata | **0** |
| Sem metadata | **534** |
| Com equipment | 302 |
| Sem equipment | **232** |
| Novos (`created_at ≥ 2026-06-16`) | 302 |
| Antigos não-curados | 232 |
| **Alto risco inferido (P1)** | **134** |
| Região **joelho** inferida | 20 (+ joelho via SQUAT/KNEE_MACH) |
| Região **lombar** inferida | 18 (HINGE) |
| Região **ombro** inferida | 12 (OHP/PUSH/SHLD_ISO) |

Distribuição por categoria inferida (heurística por nome/grupo): `UNK 189` · `PERF 98` · `ISO 69` ·
`CORE 64` · `PULL 45` · `MOB 19` · `HINGE 18` · `SQUAT 15` · `PUSH 9` · `KNEE_MACH 5` · `OHP 3`.
Prioridade inferida: **P1 134** · **P2 248** · **P3 152**.

> `UNK = 189`: exercícios cujo nome não casou com as heurísticas → marcados **P2 + conflict_notes
> (`padrao_indefinido`)** para revisão humana decidir padrão/região. **PERF = 98**: pliometria/Performance
> (high_skill/impact) → P1.

## 5. Próxima ação
- **Delta > 0** → revisar `library-curation-v1-catalog-delta-human-review.csv` (100% `needs_review`).
- **Nada** deve ser aplicado no banco nesta ordem.
- Plano de integração: `library-curation-v1-catalog-delta-integration-plan.md`.

> **Confirmação:** somente `SELECT` read-only via conector; diff/inferência feitos **localmente** contra
> os CSVs. **Sem** INSERT/UPDATE/DELETE/ALTER/CREATE, migration, edge/UI/PDF, deploy ou flag.
