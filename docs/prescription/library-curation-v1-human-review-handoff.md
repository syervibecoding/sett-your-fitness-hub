# Handoff de Revisão Humana — Curadoria da Biblioteca (v1)

> **ORDEM 035.** Pacote de entrega para o **professor/curador** revisar P1/P2/P3 com segurança.
> **Nada foi aplicado no banco.** Todos os pacotes seguem **100% `needs_review`**; todos os approved
> manifests estão **vazios/só header**.

## 1. Resumo executivo
- O **BN Prescription Engine v1** está **pronto tecnicamente** (engine determinística, adapters,
  shadow atrás de flag default OFF, testes e contrato PDF/portal verdes).
- A **biblioteca está bloqueada para shadow real** por **falta de metadata** (`exercise_metadata`
  vazia → 0 contraindications/pain tags/substitutos; veredito `BLOCKED_FOR_SHADOW`).
- Os arquivos **P1/P2/P3** são **sugestões** de curadoria para **revisão humana** — não são verdade
  clínica nem decisões.
- **Nada deve ser aplicado sem aprovação humana.** A IA **não** é aprovadora clínica.
- O objetivo é **reduzir blockers** e o `safe_alternative_unavailable`, para que o shadow vire uma
  comparação justa — **somente** depois da revisão e de uma nova ordem explícita.

## 2. O que o revisor vai receber
- **P1 human review CSV** — `library-curation-v1-p1-human-review.csv` (51 linhas)
- **P2 human review CSV** — `library-curation-v1-p2-human-review.csv` (78 linhas)
- **P3 human review CSV** — `library-curation-v1-p3-human-review.csv` (86 linhas)
- **Instruções de revisão** — este handoff + `library-curation-v1-p1-human-review-packet.md`
- **Checklist de retorno** — `library-curation-v1-p1-human-review-return-checklist.md`
- **Protocolo de validação** — `library-curation-v1-human-review-return-protocol.md`

## 3. Ordem recomendada de revisão
1. **P1 primeiro** — maior risco.
2. **P2 depois** — compostos moderados.
3. **P3 por último** — isolados/acessórios/opções seguras.

**P1** contém os exercícios de **maior impacto operacional**:
- overhead / desenvolvimentos;
- terra / hinge carregado;
- carga axial;
- joelho profundo / carregado;
- múltiplas regiões de risco.

## 4. Campos que NÃO devem ser editados
- `exercise_id`
- `exercise_name`
- `muscle_group`
- `max_priority`
- `risk_regions`
- `movement_patterns`
- `source_packages`

## 5. Campos que podem ser editados
- `suggested_contraindications`
- `suggested_pain_limitation_tags`
- `suggested_regressions`
- `suggested_equivalent_substitutes`
- `suggested_progressions`
- `suggested_equipment`
- `reviewer_status`
- `reviewer_name`
- `reviewed_at`
- `reviewer_notes`
- `approval_decision_reason`
- `ready_for_upsert`

## 6. Estados permitidos
- `needs_review`
- `approved`
- `rejected`
- `needs_more_info`

**Proibido nesta fase:** `applied` (só após execução controlada + reauditoria).

## 7. Regras para `approved`
`approved` só pode ser usado quando:
- `reviewer_name` preenchido;
- `reviewed_at` preenchido;
- `approval_decision_reason` preenchido;
- `ready_for_upsert=true`;
- `substitutes`/`regressions`/`progressions` **existem na biblioteca**;
- **conflito** ou **múltiplas regiões de risco** têm `reviewer_notes`;
- o revisor **validou tecnicamente** (assume a responsabilidade).

## 8. Regras para `rejected`
- `approval_decision_reason` preenchido (motivo);
- `ready_for_upsert=false` ou vazio.

## 9. Regras para `needs_more_info`
- `reviewer_notes` preenchido (o que falta);
- `ready_for_upsert=false` ou vazio.

## 10. Linguagem clínica segura
- **Não** usar diagnóstico clínico.
- **Não** dizer que um exercício “trata” uma lesão.
- Usar linguagem de **cautela, restrição, conforto, tolerância** e **revisão profissional**.
- Em caso de dúvida, **manter conservador**.

## 11. Como devolver
- Devolver o **CSV no mesmo formato**.
- **Não renomear** colunas.
- **Não apagar** linhas.
- **Não alterar** IDs.
- **Não** transformar o CSV em PDF.
- **Não** mandar print como fonte final.

## 12. O que ATENA fará depois
1. Rodar o **validador offline**.
2. **Gerar o approved manifest**.
3. **Bloquear** se houver erro.
4. **Revisar** o approved manifest.
5. **Preparar backup** de `exercise_metadata`.
6. **Staging primeiro** (template SQL com `ROLLBACK`).
7. **Reauditoria** (`bn-prescription-engine-v1-library-metadata-audit.sql`).
8. **Produção somente com nova ordem explícita.**

## 13. Não fazer
- Não aplicar direto no banco.
- Não rodar SQL manual.
- Não aprovar em lote sem leitura.
- Não usar IA como aprovador clínico final.
- Não ligar shadow/cutover por causa do CSV revisado.
- Não fazer deploy.

## 14. Status
- **Human Review Handoff = PREPARED**
- **Banco = UNCHANGED**
- **Approved manifests = EMPTY**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
