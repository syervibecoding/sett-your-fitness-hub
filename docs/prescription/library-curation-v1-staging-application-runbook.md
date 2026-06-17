# Runbook de Aplicação em Staging — Curadoria da Biblioteca (v1)

> **ORDEM 037.** Procedimento operacional para **aplicação FUTURA em staging** quando o
> professor/curador devolver um CSV revisado. **Este runbook NÃO autoriza aplicar agora.** Banco
> intocado; approved manifests vazios/só header.

## 1. Resumo executivo
- Este runbook é para **aplicação futura em staging** — não é autorização para aplicar agora.
- **Produção continua fora do escopo.**
- **Shadow / cutover / flag ON continuam proibidos.**
- Tudo começa com um **CSV revisado por humano** (professor/curador).

## 2. Pré-condições obrigatórias
Antes de **qualquer** aplicação futura:
- CSV revisado **recebido** do professor/curador.
- `reviewer_status` preenchido corretamente.
- `validate-curation-review-board.mjs` **sem errors**.
- **Approved manifest gerado** (`build-approved-curation-manifest.mjs`).
- Approved manifest **revisado pela ATENA**.
- **Backup planejado**.
- **Staging disponível**.
- **Deno check pendente da edge resolvido** antes de qualquer shadow.
- **Autorização explícita da ATENA** para staging.

## 3. Fluxo completo
| Etapa | Ação |
|---|---|
| A | Receber CSV revisado |
| B | Salvar **cópia original** (sem editar) |
| C | Rodar **validator** |
| D | Corrigir errors **ou** devolver ao revisor |
| E | Gerar **approved manifest** |
| F | **Revisar** approved manifest (ATENA + curador) |
| G | Gerar **SQL no-op** para inspeção |
| H | Gerar **SQL staging** — **apenas** com ack **e** ordem ATENA |
| I | Fazer **backup** em staging |
| J | **Aplicar em staging** |
| K | Rodar **audit.sql** |
| L | Comparar **métricas antes/depois** |
| M | Rodar **testes locais** |
| N | **Só então** pedir decisão para **shadow diagnóstico** |

## 4. Comandos para P1
**Validator P1:**
```bash
node scripts/prescription/validate-curation-review-board.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p1-human-review.csv \
  --expect-priority P1 \
  --report docs/prescription/library-curation-v1-p1-human-review-validation-report.md
```
**Builder approved P1:**
```bash
node scripts/prescription/build-approved-curation-manifest.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --review docs/prescription/library-curation-v1-p1-human-review.csv \
  --expect-priority P1 \
  --out docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --report docs/prescription/library-curation-v1-approved-manifest-p1-report.md
```
**SQL no-op P1 (inspeção, seguro):**
```bash
node scripts/prescription/build-curation-upsert-sql.mjs \
  --approved docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --out docs/prescription/library-curation-v1-approved-manifest-p1-upsert.noop.sql \
  --mode noop
```
**SQL staging P1 (FUTURO) — ⛔ NÃO EXECUTAR SEM ORDEM ATENA:**
```bash
# ⛔ NÃO EXECUTAR SEM ORDEM ATENA — gera SQL com dados aprovados (arquivo temporário, não commitar)
node scripts/prescription/build-curation-upsert-sql.mjs \
  --approved docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --out /tmp/library-curation-v1-approved-manifest-p1-upsert.staging.sql \
  --mode staging \
  --ack-human-approved YES_I_HAVE_REVIEWED_APPROVED_MANIFEST
```

## 5. Comandos para P2/P3
**Idênticos aos de P1, trocando `p1`→`p2`/`p3` e `--expect-priority P1`→`P2`/`P3`** nos 3 comandos
(validator, builder, SQL no-op) e no comando staging futuro. Ordem recomendada: **P1 → P2 → P3**, com
backup/reauditoria **entre cada lote**.

## 6. Backup antes da aplicação
Antes de **qualquer** aplicação em staging (ver `library-curation-v1-staging-backup-template.sql`):
- **Exportar `exercise_metadata` atual** (snapshot completo) → CSV.
- **Exportar as linhas-alvo** por `exercise_id` (antes/depois) para diff.
- **Salvar timestamp** (UTC).
- **Salvar o approved manifest usado** (caminho + hash).
- **Salvar reviewer/aprovador** responsável.
- **Salvar o SQL gerado** (staging).
- **Manter rollback possível** (tabela de backup + procedimento de restore).

## 7. Aplicação em staging
- **Staging primeiro** — **nunca produção**.
- Rodar o SQL gerado **somente** depois de revisão humana **e** ordem ATENA.
- **Registrar:** quem executou, data/hora, arquivo usado, hash do approved manifest.
- **Se qualquer erro ocorrer → PARAR** (não tentar "consertar no banco"; ver Rollback).

## 8. Reauditoria depois da aplicação
Rodar: `docs/prescription/bn-prescription-engine-v1-library-metadata-audit.sql`.

Esperado após **P1**:
- `exercise_metadata` **> 0**.
- alto risco **sem** contraindications **reduzido**.
- pain tags **começam a aparecer**.
- padrões seguros **começam a destravar**.
- `status_sugerido` pode **ainda** continuar `ACCEPT_WITH_NOTES` ou `BLOCKED` até P2/P3 entrarem.

## 9. Critérios para avançar para shadow diagnóstico
Somente considerar se:
- a **auditoria melhora**;
- **alto risco sem contraindications = 0** (ou justificado por linha);
- **padrões essenciais têm ≥3 alternativas seguras**;
- **joelho/lombar/ombro têm tags mínimas**;
- **Deno check da edge passa**;
- **flag default continua `off`**;
- **shadow autorizado explicitamente** pela ATENA.

## 10. Rollback
- Usar o **backup** de `exercise_metadata`.
- **Restaurar apenas as linhas afetadas** (por `exercise_id`).
- **Reauditar** depois do rollback.
- **Registrar incidente** (o que foi aplicado, por quem, manifest hash, resultado).

## 11. Produção
- **Fora do escopo.**
- Exige **nova ordem ATENA**.
- Exige **staging aprovado**.
- Exige **backup**.
- Exige **rollback testado**.
- Exige **shadow diagnóstico aprovado**.
- Exige **deploy autorizado**.

## 12. Não fazer
- Não aplicar `needs_review`.
- Não aplicar CSV bruto.
- Não rodar SQL staging **sem ordem**.
- Não rodar SQL `production`.
- Não ligar shadow por conta própria.
- Não ligar flag ON.
- Não fazer deploy.
- Não usar IA como aprovador clínico final.

## 13. Status
- **Staging Application Runbook = PREPARED**
- **Banco = UNCHANGED**
- **Staging Apply = NOT_AUTHORIZED**
- **Production Apply = NOT_AUTHORIZED**
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
