# Review Board Humano da Curadoria da Biblioteca (v1)

> **ORDEM 029. NADA foi aplicado no banco. Nenhuma linha foi aprovada.** Este pacote prepara a
> **revisão humana** que transforma linhas do manifesto de `needs_review` → `approved`/`rejected`/
> `needs_more_info`, **fora do banco**. O manifesto consolidado segue **100% `needs_review`** e o
> template de upsert **não** foi executado.

Arquivos do pacote:
- `library-curation-v1-review-board.md` — este guia.
- `library-curation-v1-review-board-template.csv` — template **vazio** (só header) para qualquer lote.
- `library-curation-v1-review-board-p1.csv` — **51** linhas **P1** (alto risco) prontas para revisão.

## 1. Objetivo
O Review Board serve para **revisão humana dos metadados sugeridos** antes de **qualquer** aplicação
em `exercise_metadata`. Ele recebe as sugestões do manifesto consolidado (ORDEM 027) e registra a
decisão humana por linha, sem tocar no banco. Só o que for **`approved`** por um profissional poderá,
no futuro (ORDEM 028, com backup/staging/reauditoria), virar lote de upsert.

## 2. Papéis
- **Curador técnico** — prepara/organiza as sugestões, confere ids/nomes na biblioteca, sinaliza conflitos.
- **Professor/treinador revisor** — valida clinicamente tags, contraindications, substitutos e segurança.
- **Responsável de produto** — prioriza lotes, decide escopo e cadência; não decide clínica.
- **Executor SQL futuro** — aplica em staging→produção **só** o conjunto `approved`, com backup/rollback.
- **Orquestrador / ATENA** — coordena o fluxo, registra status e autoriza (ou não) etapas seguintes.

## 3. Estados permitidos
`needs_review` · `approved` · `rejected` · `needs_more_info` · `applied`

Regras:
- Somente **`approved`** pode entrar em upsert futuro.
- **`rejected` nunca** entra.
- **`needs_more_info`** volta para curadoria até virar `approved`/`rejected`.
- **`applied`** só **depois** de execução controlada (staging→prod) + **reauditoria** OK.
- **Ninguém edita produção diretamente** sem plano aprovado (ver `library-curation-v1-application-plan.md`).

## 4. Critérios de aprovação humana
Uma linha só pode virar **`approved`** se **todos** abaixo forem verdadeiros:
- `exercise_id` **existe** na `exercise_library`.
- `exercise_name` **confere** com o nome real.
- `suggested_contraindications` estão **corretas e conservadoras**.
- `suggested_pain_limitation_tags` estão **corretas**.
- `suggested_regressions` / `suggested_equivalent_substitutes` / `suggested_progressions` **existem** na biblioteca.
- O **substituto preserva o padrão de movimento ou o músculo-alvo** sempre que possível.
- Se o substituto for de **padrão diferente**, há `reviewer_notes` **justificando**.
- `suggested_equipment` **faz sentido** para o exercício.
- **P1** foi revisado com **atenção extra**.
- **Não há diagnóstico clínico** no texto.
- **Não há decisão clínica automatizada** (IA não aprova clínica).
- **Professor/curador validou** (nome + data preenchidos).

## 5. Critérios de rejeição
Marcar **`rejected`** quando:
- Tags estão **erradas**.
- `contraindication` é **excessiva ou insuficiente**.
- `substitute`/`regression` **não existe**.
- `substitute` muda o **músculo-alvo sem justificativa**.
- O exercício **não deveria** receber a metadata proposta.
- Há **risco clínico não resolvido**.
- **Falta informação** para aplicar com segurança (preferir `needs_more_info` se for sanável).

## 6. Critérios de needs_more_info
Usar **`needs_more_info`** quando:
- O exercício é **ambíguo**.
- O **equipamento não está claro**.
- O **padrão de movimento não está claro**.
- O **substituto precisa ser confirmado**.
- O **curador precisa consultar o professor**.
- O exercício aparece em **múltiplas regiões** e há **conflito de tags**.

## 7. Ordem de revisão
Prioridade:
1. **P1** (alto risco)
2. Exercícios com **`conflict_notes`**
3. Exercícios com **múltiplas fontes** (`source_packages` ≥ 2)
4. **P2**
5. **P3**

Regras:
- **P1 exige revisão humana explícita** (nada de aprovação automática).
- Itens com **múltiplas regiões de risco** exigem `reviewer_notes`.
- **Nada** pode ser aprovado **em lote sem leitura** linha a linha.

## 8. Checklist por linha
Para cada `exercise_id`, confirmar:
- [ ] **ID real** conferido (existe na `exercise_library`)
- [ ] **Nome** conferido
- [ ] **Grupo muscular** conferido
- [ ] **Região de risco** conferida
- [ ] **Contraindications** revisadas
- [ ] **Pain tags** revisadas
- [ ] **Regressions** reais
- [ ] **Substitutes** reais
- [ ] **Equipment** revisado
- [ ] **Priority** revisada
- [ ] **Clinical wording seguro** (sem diagnóstico/decisão clínica automatizada)
- [ ] **Reviewer status final** definido
- [ ] **Reviewer notes** preenchido quando necessário (conflito, padrão diferente, multi-região)

## 9. Como preencher o CSV
- **Não editar `exercise_id`.**
- **Não editar `exercise_name`** sem confirmar na biblioteca.
- Preencher **`reviewer_status`** (`approved`/`rejected`/`needs_more_info`).
- Preencher **`reviewer_name`** (quem revisou).
- Preencher **`reviewed_at`** (data/hora UTC, ex.: `2026-06-16T15:30Z`).
- Preencher **`reviewer_notes`** (observações; obrigatório em conflito/padrão diferente/multi-região).
- Preencher **`approval_decision_reason`**:
  - para **`approved`** → justificar se houver conflito;
  - para **`rejected`** → explicar o motivo;
  - para **`needs_more_info`** → dizer **o que falta**.
- **`ready_for_upsert`** → manter `false`; só vira `true` para linhas `approved` e validadas (ver §10).

## 10. Como virar lote de aplicação futuro
1. **Filtrar apenas `approved`** (e `ready_for_upsert = true`).
2. **Gerar `approved_manifest`** (subconjunto revisado).
3. **Validar IDs** (todos existem na `exercise_library`).
4. **Validar substitutes/regressions/progressions** (existem; substitutos resolvem nome→`uuid`).
5. **Rodar backup** (snapshot de `exercise_metadata`).
6. **Rodar o template SQL em staging primeiro** (`library-curation-v1-upsert-template.sql`, com guarda removida conscientemente e `ROLLBACK`→`COMMIT` só após validar).
7. **Reexecutar `bn-prescription-engine-v1-library-metadata-audit.sql`**.
8. **Só depois** considerar produção (com backup/rollback prontos).

## 11. Não fazer
- Não aplicar `needs_review`.
- Não aplicar sem professor/curador.
- Não rodar upsert direto do **CSV bruto**.
- Não usar **IA como aprovador clínico final**.
- Não alterar banco nesta etapa.
- Não ligar shadow/cutover por causa da revisão.

## 12. Decisão
- **Review board = PREPARADO**
- **Aplicação no banco = NOT_AUTHORIZED**
- **Shadow real = NOT_AUTHORIZED**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**

---

### Confirmação de não-alteração (ORDEM 029)
- Apenas leitura do manifesto/plano + `SELECT` read-only para confirmar os **51** ids P1 (51/51 existem).
- **Sem** INSERT/UPDATE/DELETE/ALTER/CREATE, migration, alteração de engine/edge/UI, deploy ou flag.
- **Nenhuma linha aprovada**: P1 CSV 100% `needs_review`, `ready_for_upsert = false`; template só header.
