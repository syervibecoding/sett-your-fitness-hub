# Gerador de SQL de Upsert da Curadoria (v1)

> **ORDEM 036.** Gerador **offline e protegido** que transforma um **approved manifest validado** em
> SQL de upsert **futuro** para `exercise_metadata`. **Não conecta no banco, não executa SQL, não cria
> migration, não altera dados.** Nesta fase (0 linhas aprovadas) produz **SQL no-op**.

## 1. Objetivo
Converter o approved manifest (saída do `build-approved-curation-manifest.mjs`) em um arquivo `.sql`
que **um humano** poderá revisar e rodar **em staging** no futuro. O gerador **apenas escreve um
arquivo** — nunca executa nada. Enquanto não houver linhas `approved`, o SQL é **no-op** (só
comentários + um `SELECT` explicativo read-only).

## 2. Pré-condições (para gerar SQL com dados, no futuro)
- Revisão humana concluída (professor/curador).
- `validate-curation-review-board.mjs` sem **errors**.
- Approved manifest gerado (`build-approved-curation-manifest.mjs`).
- **Backup** planejado de `exercise_metadata`.
- **Staging primeiro** (rodar com `ROLLBACK`).
- **ATENA autorizou** explicitamente.

## 3. Modos
- **`noop`** (default) — só comentários + `SELECT` explicativo. **Nunca** gera INSERT/UPDATE ativo.
  Se houver linhas aprovadas, apenas comenta quantas/quais seriam processadas.
- **`staging`** — gera o upsert **somente** com a flag explícita
  `--ack-human-approved YES_I_HAVE_REVIEWED_APPROVED_MANIFEST`. Sem a flag e **com** linhas aprovadas,
  **falha**. O SQL gerado vem em `BEGIN … ROLLBACK;` (COMMIT comentado).
- **`production`** — **bloqueado nesta fase**: falha com
  `Production SQL generation is not authorized by ATENA.`

## 4. Como rodar no modo no-op
```bash
node scripts/prescription/build-curation-upsert-sql.mjs \
  --approved docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --out docs/prescription/library-curation-v1-approved-manifest-p1-upsert.noop.sql \
  --mode noop
```

## 5. Como rodar futuramente em staging (somente após aprovação humana + ordem ATENA)
```bash
# SÓ depois de revisão humana concluída, validator sem errors, backup pronto e ordem ATENA:
node scripts/prescription/build-curation-upsert-sql.mjs \
  --approved docs/prescription/library-curation-v1-approved-manifest-p1.csv \
  --out /caminho/staging/p1-upsert.staging.sql \
  --mode staging \
  --ack-human-approved YES_I_HAVE_REVIEWED_APPROVED_MANIFEST
```
> O SQL de staging vem com `ROLLBACK` por padrão; trocar para `COMMIT` é decisão **humana**, só em
> staging, com backup. Esse arquivo **não** é commitado quando contém dados reais.

## 6. Por que `production` é bloqueado
Produção requer: **ordem explícita** da ATENA, **backup** verificado, **staging** validado,
**reauditoria** (`bn-prescription-engine-v1-library-metadata-audit.sql`) e **rollback testado**. Nada
disso é responsabilidade do gerador — por isso ele recusa `--mode production`.

## 7. Segurança
- **Não** conecta no banco.
- **Não** executa SQL.
- **Não** cria migration.
- **Não** aplica `needs_review` / `rejected` / `needs_more_info` (usa **somente** o approved manifest,
  que por construção só tem `approved` + `ready_for_upsert=true`).
- O SQL gerado **precisa ser revisado** antes de qualquer execução.
- Escapa strings para literal SQL (aspas simples → duplicadas).
- `equivalent_substitutes` (uuid[]): os **nomes** são resolvidos por subquery em `exercise_library`
  (`name = ANY(...)`), nunca inventando ids.

## 8. SCHEMA_GAP
Colunas reais de `exercise_metadata` usadas: `exercise_id`, `contraindications`,
`pain_limitation_tags`, `regressions`, `progressions`, `equivalent_substitutes`, `notes`.
Campos do manifesto **sem coluna** (registrados como `SCHEMA_GAP` no cabeçalho do SQL, **sem inventar
coluna**):
- `equipment` → vive em `exercise_library.equipment` (text único), não em `exercise_metadata`.
- `muscle_group`, `source_packages`, `risk_regions`, `movement_patterns`, `max_priority` → sem coluna
  (insumo de curadoria / bookkeeping).
- `exercise_name`, `reviewer_name`, `reviewed_at` → proveniência: vão para comentário / dobrados em `notes`.

## 9. Próxima etapa depois de gerar SQL
1. **Revisão humana** do SQL gerado.
2. **Backup** de `exercise_metadata`.
3. **Staging** (rodar com `ROLLBACK`, validar).
4. **Reauditoria** (auditoria de metadata).
5. **Produção somente com nova ordem** explícita da ATENA.
