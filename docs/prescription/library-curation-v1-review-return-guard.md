# Return Guard do CSV Revisado (Curadoria v1)

> **ORDEM 038.** Guard **offline** que compara o **CSV enviado** ao revisor com o **CSV devolvido**,
> bloqueando mudanças em campos protegidos, linhas removidas/adicionadas, IDs alterados/duplicados.
> Roda **antes** do `validate-curation-review-board.mjs`. **Não conecta no banco, não executa SQL.**

## 1. Objetivo
Garantir que o professor/curador **só** alterou os campos permitidos. O guard compara o arquivo
**enviado** (`--sent`) com o **devolvido** (`--returned`) por `exercise_id` e bloqueia qualquer
adulteração estrutural antes de o conteúdo seguir para o validador.

## 2. Ordem correta do pipeline
| Passo | Ação |
|---|---|
| A | Receber CSV revisado |
| B | **Rodar o return guard** (este script) |
| C | Rodar `validate-curation-review-board` |
| D | Rodar `build-approved-curation-manifest` |
| E | Revisar o approved manifest |
| F | Gerar SQL **no-op** |
| G | Staging **somente** com ordem ATENA |

## 3. Campos protegidos (não podem mudar)
- `exercise_id`
- `exercise_name`
- `muscle_group`
- `max_priority`
- `risk_regions`
- `movement_patterns`
- `source_packages`

> Qualquer coluna **fora da lista de editáveis** também é tratada como protegida (ex.: `conflict_notes`,
> que é metadado de curadoria, não campo do revisor).

## 4. Campos editáveis (o revisor pode alterar)
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

## 5. Como rodar para P1/P2/P3
```bash
# P1
node scripts/prescription/check-curation-review-return.mjs \
  --sent docs/prescription/library-curation-v1-p1-human-review.csv \
  --returned <csv-devolvido-p1> \
  --expect-priority P1 \
  --report docs/prescription/library-curation-v1-p1-return-guard-report.md

# P2
node scripts/prescription/check-curation-review-return.mjs \
  --sent docs/prescription/library-curation-v1-p2-human-review.csv \
  --returned <csv-devolvido-p2> \
  --expect-priority P2 \
  --report docs/prescription/library-curation-v1-p2-return-guard-report.md

# P3
node scripts/prescription/check-curation-review-return.mjs \
  --sent docs/prescription/library-curation-v1-p3-human-review.csv \
  --returned <csv-devolvido-p3> \
  --expect-priority P3 \
  --report docs/prescription/library-curation-v1-p3-return-guard-report.md
```
> `<csv-devolvido-pX>` é o arquivo que o revisor devolveu. Os relatórios commitados nesta ordem usam
> `sent == returned` (os arquivos atuais), comprovando o estado "sem alterações".

## 6. Como interpretar errors / warnings
- **error** → **bloqueia**: campo protegido alterado, linha removida/adicionada, id duplicado/divergente,
  `reviewer_status` inválido/`applied`, `ready_for_upsert=true` sem `approved`, prioridade divergente.
  Exit code **1**. **Não** seguir para o validator.
- **warning** → exige leitura, mas **não** falha (exit não muda por warning).
- **Sem errors** (exit 0) → pode seguir para o `validate-curation-review-board`.

## 7. O que fazer se falhar
- **Não editar o banco.**
- **Não tentar corrigir no SQL.**
- **Devolver ao revisor** ou corrigir o CSV **com rastreabilidade** (registrar o que mudou e por quê).
- **Rodar o guard novamente** até passar.

## 8. Segurança
- **Offline.**
- **Não** conecta no banco.
- **Não** executa SQL.
- **Não** aprova linha.
- **Não** gera SQL.
- **Não** faz deploy.
- Única escrita: o `--report` (se passado).
