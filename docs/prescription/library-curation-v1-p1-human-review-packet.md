# Pacote de Revisão Humana — P1 (Curadoria da Biblioteca v1)

> **ORDEM 032.** Pacote pronto para o **professor/curador** revisar os exercícios **P1** (maior risco)
> **antes** de qualquer aplicação em `exercise_metadata`. **Nada foi aplicado no banco.** O approved
> manifest atual está **vazio**. Planilha a revisar: `library-curation-v1-p1-human-review.csv` (51 linhas).

## 1. Objetivo
Este pacote é para **revisão humana** dos exercícios **P1** antes de qualquer aplicação em
`exercise_metadata`. As sugestões da curadoria são **propostas** — só viram dados aplicáveis depois que
um profissional valida cada linha. A IA **não** é o aprovador clínico.

## 2. O que é P1
P1 reúne os exercícios de **maior risco operacional**:
- overhead / desenvolvimentos;
- levantamento terra / hinge com carga;
- carga axial;
- flexão lombar carregada;
- joelho profundo / carregado;
- **múltiplas regiões de risco**;
- exercícios com maior chance de impactar **joelho / lombar / ombro**.

## 3. O que o revisor deve fazer
Escolher **um** `reviewer_status` por linha:
- `approved`
- `rejected`
- `needs_more_info`

**Não usar:**
- `applied` (proibido nesta fase — só após execução controlada + reauditoria);
- `ready_for_upsert=true` sem `reviewer_status=approved`.

## 4. Campos que o revisor pode editar
**Pode editar apenas:**
`suggested_contraindications`, `suggested_pain_limitation_tags`, `suggested_regressions`,
`suggested_equivalent_substitutes`, `suggested_progressions`, `suggested_equipment`,
`reviewer_status`, `reviewer_name`, `reviewed_at`, `reviewer_notes`, `approval_decision_reason`,
`ready_for_upsert`.

**Não editar:**
`exercise_id`, `exercise_name`, `muscle_group`, `source_packages`, `risk_regions`,
`movement_patterns`, `max_priority`.

## 5. Critério para `approved`
Uma linha só pode ser `approved` se:
- o exercício está **corretamente identificado**;
- as `contraindications` estão **conservadoras e coerentes**;
- as `pain_limitation_tags` estão **corretas**;
- `regressions`/`substitutes`/`progressions` **existem na biblioteca**;
- o `substitute`/`regression` **preserva o padrão ou o músculo-alvo** quando possível;
- havendo **conflito** ou **múltiplas regiões de risco**, `reviewer_notes` **explica**;
- **não há diagnóstico clínico** no texto;
- o revisor **assume a responsabilidade técnica** da aprovação.

## 6. Critério para `rejected`
Usar `rejected` quando:
- tags estão **erradas**;
- `contraindication` está **excessiva ou insuficiente**;
- `substitute`/`regression` **não existe**;
- `substitute` **muda o alvo sem justificativa**;
- o exercício **não deveria receber** esse metadata;
- há **risco clínico não resolvido**.

## 7. Critério para `needs_more_info`
Usar quando:
- o **equipamento** não está claro;
- o **padrão de movimento** está ambíguo;
- o **substituto precisa ser confirmado**;
- o exercício aparece em **múltiplas regiões** e exige **discussão**;
- **faltam dados** para aprovar com segurança.

## 8. Regras para `ready_for_upsert`
- `true` **somente** se `reviewer_status=approved`.
- `false` ou vazio para qualquer outro status.
- `approved` exige `reviewer_name`, `reviewed_at` e `approval_decision_reason`.
- Linhas com `conflict_notes` exigem `reviewer_notes`.
- Linhas com **múltiplas** `risk_regions` exigem `reviewer_notes`.
- Linhas com **múltiplos** `source_packages` exigem `reviewer_notes`.

## 9. Como devolver o arquivo
- Manter o **formato CSV**.
- **Não renomear** colunas.
- **Não apagar** linhas.
- **Não alterar** `exercise_id` (nem `exercise_name`).
- Devolver o **arquivo revisado** (mesmo nome ou claramente identificado).
- A **ATENA rodará o validador offline** antes de qualquer SQL.

## 10. O que acontecerá depois
1. Rodar `validate-curation-review-board` (checagem offline).
2. Gerar o **approved manifest** (`build-approved-curation-manifest`).
3. **Revisar** o approved manifest.
4. **Backup** de `exercise_metadata`.
5. **Staging primeiro** (template SQL com `ROLLBACK`).
6. **Reauditoria** (`bn-prescription-engine-v1-library-metadata-audit.sql`).
7. **Só depois** considerar produção — **com nova ordem explícita**.

## 11. Não fazer
- Não aplicar direto no banco.
- Não mandar SQL manual.
- Não usar IA como aprovador clínico final.
- Não ligar shadow/cutover por causa deste pacote.
- Não transformar sugestão em verdade clínica sem revisão.

## 12. Status
- **Human Review Packet P1 = PREPARED**
- **Banco = UNCHANGED**
- **Approved manifest = EMPTY**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
