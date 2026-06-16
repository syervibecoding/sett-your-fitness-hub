# Validador Offline do Review Board (v1)

> **ORDEM 030.** Ferramenta de checagem **offline** de um CSV de revisão humana **antes** de qualquer
> upsert futuro. **Não conecta no banco, não executa SQL, não altera dados, não faz deploy.**

## 1. Objetivo
Garantir que um CSV de revisão (ex.: `library-curation-v1-review-board-p1.csv`) está **consistente e
seguro** antes de virar `approved_manifest`. O validador confere ids contra o manifesto consolidado,
o domínio de `reviewer_status`, as regras de transição (`approved`/`rejected`/`needs_more_info`/
`needs_review`/`applied`), os pré-requisitos de aprovação e a existência de substitutos/regressões/
progressões. **Não decide clínica** — apenas trava inconsistências.

## 2. Como rodar
```bash
node scripts/prescription/validate-curation-review-board.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review   docs/prescription/library-curation-v1-review-board-p1.csv \
  --expect-priority P1 \
  --report   docs/prescription/library-curation-v1-review-board-p1-validation-report.md
```
Argumentos:
- `--manifest <path>` — manifesto consolidado (fonte da verdade offline de ids/nomes).
- `--review <path>` — CSV de revisão humana a validar.
- `--expect-priority <P1|P2|P3|any>` — se != `any`, exige que todas as linhas tenham esse `max_priority`.
- `--report <path>` *(opcional)* — escreve o relatório markdown. **Única escrita** que o script faz.

Sem dependências externas (apenas `fs`/`path`/`process`). ESM puro.

## 3. Arquivos que usa
- **Lê:** o manifesto e o review CSV passados por argumento.
- **Escreve:** somente o `--report` (se passado). Nada mais.

## 4. Explicação das validações
1. Arquivos existem. 2. CSV parseável. 3. Headers obrigatórios no manifesto. 4. Headers obrigatórios no
review. 5. Todo `exercise_id` do review existe no manifesto. 6. Sem `exercise_id` duplicado. 7. Com
`--expect-priority P1`, todas as linhas devem ser `max_priority=P1`. 8. `reviewer_status` ∈
{`needs_review`,`approved`,`rejected`,`needs_more_info`,`applied`}. 9. `applied` é **erro** nesta fase
(só existe após execução controlada + reauditoria). 10. `ready_for_upsert=true` só com
`reviewer_status=approved`. 11. `approved` exige `reviewer_name` + `reviewed_at` +
`approval_decision_reason` + `ready_for_upsert=true`. 12. `rejected` exige `approval_decision_reason` e
`ready_for_upsert` false/vazio. 13. `needs_more_info` exige `reviewer_notes` e `ready_for_upsert`
false/vazio. 14. `needs_review` exige `ready_for_upsert` false/vazio. 15. `approved` com
`conflict_notes` exige `reviewer_notes`. 16. `approved` com **múltiplas** `risk_regions` exige
`reviewer_notes`. 17. `approved` com **múltiplos** `source_packages` exige `reviewer_notes`.
18/19/20. `suggested_equivalent_substitutes`/`suggested_regressions`/`suggested_progressions` não podem
conter itens **claramente desconhecidos** quando preenchidos (ver §5). 21. Reporta totais, contagem por
status, `ready_for_upsert=true`, errors, warnings e as listas. 22. Exit `0` sem errors, `1` com errors.
23. Warnings não falham. 24. Não conecta no Supabase. 25. Não escreve nada além do `--report`.

## 5. Diferença entre **error** e **warning**
- **error** — quebra de regra estrutural/segurança (id inexistente, status inválido, `approved` sem
  campos obrigatórios, `applied` nesta fase, `ready_for_upsert=true` sem `approved`, item de
  substituto/regressão/progressão **claramente não-exercício** — ex.: começa com `(` ou tem `—`).
  **Falha o script (exit 1).**
- **warning** — **ambiguidade textual**: o item preenchido não consta no manifesto, mas não é
  claramente inválido. Ex.: variante real fora do manifesto-215 (`Leg Press 45 Unilateral`) ou **cue
  de texto livre** em `progressions`/`regressions` (`ROM indolor`, `Progredir reps antes de carga`).
  Como `regressions`/`progressions` são `text[]` **livres** no schema (não-FK), warnings nesses campos
  são **esperados** e aceitáveis. **Não falha o script.**

> Critério de "conhecido": o validador, offline, considera conhecido qualquer `exercise_id` **ou**
> `exercise_name` presente no **manifesto**. Como o manifesto tem 215 linhas (subconjunto da
> biblioteca), itens válidos fora dele aparecem como **warning**, não erro — confirmar na biblioteca.

## 6. Critério para um CSV virar `approved_manifest`
Só seguir para a etapa de aplicação (ORDEM 028) quando, para o conjunto a aplicar:
- **0 errors** no validador;
- todas as linhas-alvo `reviewer_status=approved` **e** `ready_for_upsert=true`;
- cada `approved` com `reviewer_name`, `reviewed_at`, `approval_decision_reason` preenchidos;
- `reviewer_notes` presente onde há `conflict_notes`/multi-região/multi-fonte;
- warnings de substitutos revisados (confirmados reais na biblioteca pelo curador).

## 7. O que fazer quando houver **erro**
- **Não aplicar nada.** Corrigir o CSV de revisão (ou devolver à curadoria) e rodar o validador de novo.
- Erros de substituto/regressão "claramente desconhecido" → corrigir o nome/id ou remover a sugestão.

## 8. O que fazer quando houver **warning**
- Revisar item a item: confirmar na biblioteca se o substituto/variante existe; para cues de texto
  livre, decidir se ficam como nota de execução. Warnings **não** bloqueiam o exit, mas **devem** ser
  lidos antes de aprovar. Não promova uma linha a `approved` sem resolver warnings de substituto.

## 9. Regras de segurança
- **Não aplicar `needs_review`.**
- **Não aplicar `approved`** sem `reviewer_name`/`reviewed_at`/`approval_decision_reason`.
- **Não aplicar** quando houver `conflict_notes` (ou multi-região/multi-fonte) **sem** `reviewer_notes`.
- **Não aplicar** se substitute/regression/progression **não existir** (resolver antes).
- A revisão final é **humana/clínica**; a IA/validador **não aprova**.

## 10. Confirmação
- O script é **offline**.
- **Não conecta ao banco.**
- **Não executa SQL.**
- **Não faz deploy.**
- **Não altera dados** (única escrita: o `--report`, se passado).
