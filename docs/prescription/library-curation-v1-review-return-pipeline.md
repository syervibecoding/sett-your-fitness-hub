# Pipeline de Devolução da Curadoria da Biblioteca (v1) — caminho padrão offline

> Runner: `scripts/prescription/run-curation-review-return-pipeline.mjs` (ATENA / ORDEM 039).
> **Offline.** Não conecta no banco, não executa SQL, não faz deploy, não toca flag/cutover.

## 1. Objetivo

Definir o **caminho padrão** para processar o CSV que o professor/curador **devolve** depois de
revisar um pacote de human-review. O runner encadeia, em uma única invocação e na ordem segura, os
quatro scripts já existentes da curadoria — desde o guard de devolução até a geração de SQL no-op —
e produz **um relatório final único** com o status PASS/FAIL e todas as confirmações de segurança.

A ideia é eliminar o passo-a-passo manual (e o risco de pular o guard ou rodar o gerador de SQL fora
de hora) e garantir que **nenhum SQL** seja gerado quando a devolução não está íntegra.

## 2. Ordem do pipeline

```
1) return guard         → check-curation-review-return.mjs
2) validador            → validate-curation-review-board.mjs
3) approved manifest    → build-approved-curation-manifest.mjs
4) SQL no-op            → build-curation-upsert-sql.mjs   (SEMPRE --mode noop)
5) relatório final      → <label>-return-pipeline-report.md
```

O runner **para no primeiro erro**. Mesmo com `--keep-going true`, ele **nunca** gera SQL se o
**return guard** OU o **validador** falharem.

## 3. Por que o return guard vem antes

O return guard compara o CSV **enviado** (sent) com o CSV **devolvido** (returned) e bloqueia
adulterações antes que qualquer outra etapa toque nos dados. Ele falha (e interrompe o pipeline) se:

- um **exercise_id** foi alterado;
- um **exercise_name** foi alterado;
- uma **linha foi removida** da devolução;
- uma **linha foi adicionada** na devolução;
- a **prioridade** (`max_priority`) foi alterada / diverge da esperada;
- qualquer **campo protegido** foi alterado (`muscle_group`, `risk_regions`, `movement_patterns`,
  `source_packages`, `conflict_notes`, etc. — tudo que não é editável pelo revisor);
- `reviewer_status` inválido / `applied`; `ready_for_upsert=true` sem `approved`.

Rodar o guard **primeiro** garante que validador, approved manifest e SQL só vejam uma devolução
estruturalmente fiel ao que foi enviado.

## 4. Quando usar

- **Depois** de receber o CSV revisado pelo professor/curador (a devolução de um pacote P1/P2/P3).
- **Antes** de gerar qualquer SQL de staging.
- **Antes** de discutir o shadow diagnóstico / aplicação controlada.

## 5. Como rodar (P1 / P2 / P3)

Argumentos obrigatórios: `--manifest --sent --returned --priority --out-dir`.
Opcionais: `--label <short>` e `--keep-going false|true` (default `false`).

**P1:**
```bash
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --sent     docs/prescription/library-curation-v1-p1-human-review.csv \
  --returned <CSV_DEVOLVIDO_P1> \
  --priority P1 \
  --out-dir  docs/prescription \
  --label    library-curation-v1-p1
```

**P2:**
```bash
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --sent     docs/prescription/library-curation-v1-p2-human-review.csv \
  --returned <CSV_DEVOLVIDO_P2> \
  --priority P2 \
  --out-dir  docs/prescription \
  --label    library-curation-v1-p2
```

**P3:**
```bash
node scripts/prescription/run-curation-review-return-pipeline.mjs \
  --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv \
  --sent     docs/prescription/library-curation-v1-p3-human-review.csv \
  --returned <CSV_DEVOLVIDO_P3> \
  --priority P3 \
  --out-dir  docs/prescription \
  --label    library-curation-v1-p3
```

> No smoke test, `--sent` e `--returned` apontam para o mesmo CSV P1 (devolução idêntica ao enviado);
> isso resulta em PASS com approved manifest vazio (só header) e SQL no-op.

### Arquivos gerados (exemplo P1, `--out-dir docs/prescription --label library-curation-v1-p1`)

| artefato | caminho |
|---|---|
| return guard report | `docs/prescription/library-curation-v1-p1-return-guard-report.md` |
| validation report | `docs/prescription/library-curation-v1-p1-human-review-validation-report.md` |
| approved manifest CSV | `docs/prescription/library-curation-v1-approved-manifest-p1.csv` |
| approved manifest report | `docs/prescription/library-curation-v1-approved-manifest-p1-report.md` |
| SQL no-op | `docs/prescription/library-curation-v1-approved-manifest-p1-upsert.noop.sql` |
| relatório final | `docs/prescription/library-curation-v1-p1-return-pipeline-report.md` |

Vários desses arquivos já existem em `docs/prescription`; o runner os **regenera** (comportamento
esperado). Ele não apaga arquivos não relacionados.

## 6. Como interpretar o resultado

O relatório final traz `## Status final: PASS` ou `FAIL` e, em caso de falha, o **motivo da parada**:

| status / motivo | significado | o que NÃO rodou |
|---|---|---|
| **PASS** | todos os 4 passos passaram | — |
| **RETURN_GUARD_FAILED** | a devolução adulterou ID/nome/linha/prioridade/campo protegido | validador, approved, SQL |
| **VALIDATION_FAILED** | guard passou, mas o review board tem erro de regra (ex.: `approved` sem `reviewer_name`) | approved, SQL |
| **APPROVED_MANIFEST_FAILED** | guard+validador passaram, mas o builder do approved manifest acusou erro | SQL |
| **NOOP_SQL_FAILED** | passos 1–3 ok, mas a geração do SQL no-op falhou (ex.: caminho de saída inválido) | — |

Métricas-chave no relatório: `approved_rows` e `ready_for_upsert_rows` (lidas do approved report) e
`SQL mode: noop`.

## 7. Segurança (garantias do runner)

- **Não conecta no banco.** Nenhum dos passos abre conexão.
- **Não executa SQL.** O passo 4 só **gera** um arquivo `.noop.sql` (comentários + `SELECT` read-only).
- **Sempre `--mode noop`.** O runner nunca chama o gerador de SQL em `staging`/`production`.
- **Não staging / não production.** Geração de upsert real exige decisão humana fora deste runner.
- **Não aprova nada sozinho.** O approved manifest só emite linhas que o revisor marcou
  `approved` + `ready_for_upsert=true`; sem isso, sai vazio (só header).
- **Não substitui revisão humana.** É um trilho de verificação, não um aprovador.
- **Não autoriza deploy / flag / cutover.** Nada de infraestrutura é tocado.

## 8. Próximo passo depois de PASS

1. **Revisar o approved manifest** (`library-curation-v1-approved-manifest-<p>.csv`): conferir cada
   linha aprovada com calma.
2. **Revisar o SQL no-op** (`...-upsert.noop.sql`): ler os `exercise_id` que *seriam* upsertados e o
   `SELECT` explicativo.
3. **Pedir autorização da ATENA** para gerar o SQL de **staging** (e só então, com backup +
   ack humano, rodar o gerador em `--mode staging`).
4. **Nunca rodar produção** a partir deste fluxo.
