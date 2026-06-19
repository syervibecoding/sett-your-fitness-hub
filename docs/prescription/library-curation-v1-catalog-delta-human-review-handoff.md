# Handoff de Revisão Humana — Catalog Delta (Curadoria v1)

> **ORDEM 045 / Parte E.** Pacote de entrega para o professor/curador revisar os **534** exercícios fora
> do manifesto (catalog_delta). **Nada aprovado; nada aplicado; banco intocado.**

## 1. Resumo executivo
- **534** exercícios estão **fora do manifesto** consolidado (215) e precisam de revisão humana.
- Todos estão **`needs_review`**; **nada foi aprovado**; **nada foi aplicado** no banco.
- Lotes prontos: P1 (134), P2 (248), P3 (152).

## 2. Por que esse lote existe
- O usuário **adicionou muitos exercícios novos** (catálogo: 447 → **749**, +302).
- A **curadoria anterior** (manifesto v1, 215) **não cobre tudo** → sobram 534 (302 novos + 232 antigos não-curados).
- O **motor já considera o catálogo vivo** (pós-ORDEM 044, sem `.limit(700)`), mas os **metadados precisam
  acompanhar** o catálogo para seleção segura por dor/restrição.

## 3. Ordem recomendada
1. **catalog_delta P1** primeiro (alto risco inferido: pliometria/overhead/hinge/agachamento).
2. **catalog_delta P2** depois.
3. **catalog_delta P3** por último.

## 4. Campos protegidos (NÃO editar)
`exercise_id`, `exercise_name`, `muscle_group`, `max_priority`, `risk_regions`, `movement_patterns`,
`source_packages`.

## 5. Campos editáveis
`suggested_contraindications`, `suggested_pain_limitation_tags`, `suggested_regressions`,
`suggested_equivalent_substitutes`, `suggested_progressions`, `suggested_equipment`, `reviewer_status`,
`reviewer_name`, `reviewed_at`, `reviewer_notes`, `approval_decision_reason`, `ready_for_upsert`.

## 6. Regras para `approved`
- `reviewer_name` preenchido.
- `reviewed_at` preenchido.
- `approval_decision_reason` preenchido.
- `ready_for_upsert = true`.
- `substitutes`/`regressions` **reais** (confirmados na biblioteca; nunca inventar).
- conflitos / multi-região / multi-fonte com `reviewer_notes`.

> Observação: os `suggested_*` vieram **vazios** (a curadoria offline não confirma substitutos sem o
> profissional). O revisor preenche com nomes reais; `conflict_notes` já sinaliza os gaps por linha.
> **Atenção pliometria/Performance:** marcar `high_skill/impact`, sem semanas 1–2, gate por nível/dor.

## 7. Não fazer
- Não aprovar em lote sem leitura.
- Não aplicar direto no banco.
- Não rodar SQL do delta.
- Não ligar shadow/cutover por causa do delta.
- Não usar IA como aprovador clínico final.

## 8. Status
- **Catalog Delta Human Review = PREPARED**
- **Approved Manifests = EMPTY**
- **Banco = UNCHANGED**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
