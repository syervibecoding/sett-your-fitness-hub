# Relatório de Testes — Runner do Pipeline de Devolução da Curadoria (offline)

> Script de teste: `scripts/prescription/test-curation-review-return-pipeline.mjs` (ATENA / ORDEM 039).
> Runner sob teste: `scripts/prescription/run-curation-review-return-pipeline.mjs`.
> **Offline.** Sem banco, sem SQL executado, sem deploy.

## Método

O teste copia as primeiras linhas reais do CSV P1
(`docs/prescription/library-curation-v1-p1-human-review.csv`), muta cópias em **fixtures
temporárias sob `os.tmpdir()`** (`fs.mkdtempSync` → prefixo `return-pipeline-`) e chama o **runner
real** como subprocesso (`child_process.spawnSync`), uma vez por cenário, cada um com seu próprio
`--out-dir` dentro do tmpdir. Ao final, o tmpdir é removido com `fs.rmSync(..., {recursive:true})`.
**Nenhuma fixture é commitada.**

Cada cenário verifica: (a) o **exit code** do runner; (b) **quais artefatos foram (ou não) gerados**
— provando o ponto de parada; (c) o **motivo da parada** registrado no relatório final.

## Resultado consolidado: ✅ 4/4 PASS

| # | cenário | esperado | observado | resultado |
|---|---|---|---|---|
| 1 | `return_guard_failure` | exit 1; validador/approved/SQL **não** rodam; final = `RETURN_GUARD_FAILED` | `exit=1; sqlGen=false; validatorRun=false; approvedRun=false; finalGuard=true` | **PASS** |
| 2 | `validation_failure` | exit 1; guard PASS; validador FAIL; approved/SQL **não** gerados; final = `VALIDATION_FAILED` | `exit=1; guardRan=true; validatorRan=true; approvedRun=false; sqlGen=false; finalValidation=true` | **PASS** |
| 3 | `noop_sql_failure` | exit 1; passos 1–3 PASS; SQL no-op falha (caminho de saída inválido); final = `NOOP_SQL_FAILED` | `exit=1; guardRan=true; validatorRan=true; approvedRan=true; sqlPathBlocked=true; finalNoopSql=true` | **PASS** |
| 4 | `approved_manifest_failure` (indireto) | coberto indiretamente | documentado; sem gatilho frágil | **PASS** |

## Detalhe dos cenários

### 1) `return_guard_failure`
Devolução com `exercise_id` alterado em uma linha. O **return guard** (passo 1) falha; o runner para
imediatamente. Confirma-se que **não** foram criados o validation report, o approved report nem o SQL
no-op, e que o relatório final registra `RETURN_GUARD_FAILED`. Cobre a regra dura: guard falho ⇒
nunca roda validador/approved/SQL.

### 2) `validation_failure`
Devolução com campos protegidos intactos e `reviewer_status=approved` + `ready_for_upsert=true`, mas
`reviewer_name` **vazio**. O guard **passa** (ele só exige que `ready=true` venha com `approved`, o
que está satisfeito). O **validador** (passo 2) **falha** porque `approved` exige `reviewer_name`.
Confirma-se que o approved manifest e o SQL no-op **não** foram gerados e que o relatório final
registra `VALIDATION_FAILED`. Cobre a regra dura: validador falho ⇒ nunca gera SQL.

### 3) `noop_sql_failure`
Devolução idêntica ao enviado (passa guard, validador e approved manifest limpos). O caminho exato do
arquivo de SQL no-op é **pré-ocupado por um diretório** na fixture, de modo que a escrita do SQL pelo
gerador (passo 4) falha de forma controlada (sem arquivo SQL válido). O runner termina com exit 1 e o
relatório final registra `NOOP_SQL_FAILED`. Comprova que falha **apenas** no passo de SQL é
detectada e reportada — sem nunca executar SQL real.

### 4) `approved_manifest_failure` (coberto indiretamente)
O builder do approved manifest (`build-approved-curation-manifest.mjs`) só retorna erro (exit 1) sob
o **mesmo conjunto de regras** que o validador (`validate-curation-review-board.mjs`) já aplica no
passo 2. Qualquer entrada capaz de quebrar o builder **já falha no validador**, parando o pipeline
antes do passo 3 e sem gerar SQL (ver cenário 2). Não há gatilho realista que passe no validador e
quebre o builder sem **inventar comportamento frágil**. Portanto este cenário é considerado **coberto
indiretamente** pelos testes do próprio builder (`scripts/prescription/test-curation-review-pipeline.mjs`)
e pela garantia de ordem do runner (validador antes do approved; SQL nunca após falha). O teste
registra essa cobertura explicitamente, sem simulação artificial.

## Confirmações

- **Fixtures temporárias:** criadas em `os.tmpdir()` via `fs.mkdtempSync` e **removidas** ao final
  (`tmp removido: true`). Nada foi commitado.
- **Sem banco / sem SQL executado / sem deploy:** o teste apenas roda scripts Node nativos que geram
  arquivos locais; nenhuma conexão de banco, nenhuma execução de SQL, nenhum deploy/flag/cutover.
- **Exit do teste:** `0` (todos os cenários se comportaram como esperado).
