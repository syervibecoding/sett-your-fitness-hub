# Relatório — Testes do Gerador de SQL de Upsert (Curadoria v1)

> **ORDEM 036.** Testes **offline** do `scripts/prescription/build-curation-upsert-sql.mjs`, com
> fixtures **temporárias** em `os.tmpdir()` (removidas ao final, **não commitadas**). **Sem banco, sem
> SQL executado, sem deploy.**

## Resumo
**Gerador de upsert = PASS** — **8/8** cenários passaram (harness exit 0). Fixtures temporárias
removidas. Nada executado no banco.

## Cenários
| # | Cenário | Esperado | Observado | Status |
|---|---|---|---|---|
| 1 | `real_p1_empty` | exit 0; SQL no-op; sem INSERT/UPDATE | exit=0; `NO_APPROVED_ROWS`; noActive=true | **PASS** |
| 2 | `production_blocked` | exit 1; "Production SQL generation is not authorized by ATENA." | exit=1; msg=true | **PASS** |
| 3 | `staging_requires_ack` | exit 1; exige `--ack-human-approved` | exit=1; ackMsg=true | **PASS** |
| 4 | `staging_with_ack_generates_sql` | exit 0; gera upsert (arquivo temporário) | exit=0; hasUpsert=true | **PASS** |
| 5 | `duplicate_exercise_id_fails` | exit 1; "duplicado" | exit=1; dup=true | **PASS** |
| 6 | `missing_required_header_fails` | exit 1; "sem header obrigatorio" | exit=1; hdr=true | **PASS** |
| 7 | `missing_required_value_fails` | exit 1; "campo obrigatorio vazio" | exit=1; val=true | **PASS** |
| 8 | `sql_escaping` | aspas simples dobradas (`''`) | exit=0; escaped=true | **PASS** |

**TOTAL: 8 | PASS: 8 | FAIL: 0**

## Saídas no-op geradas (modo `noop`)
| Arquivo | approved_rows | status | INSERT/UPDATE ativo? |
|---|---|---|---|
| `library-curation-v1-approved-manifest-p1-upsert.noop.sql` (commitado) | 0 | `NO_APPROVED_ROWS` | **Não** (0 statements ativos) |
| `/tmp/...-p2-upsert.noop.sql` (temporário) | 0 | `NO_APPROVED_ROWS` | **Não** |
| `/tmp/...-p3-upsert.noop.sql` (temporário) | 0 | `NO_APPROVED_ROWS` | **Não** |

> O SQL P1 commitado contém **apenas** cabeçalho/comentários (incl. SCHEMA_GAP) + um `SELECT`
> explicativo read-only. **Nenhum** INSERT/UPDATE/DELETE/ALTER/CREATE fora de comentário (verificado).

## Segurança
- **Não** conectou no Supabase.
- **Nenhum SQL executado.**
- **Nenhum banco alterado.**
- Fixtures e SQLs com dados foram **temporários** (`os.tmpdir()`), **removidos** ao final
  (`tmp removido: true`) e **não commitados**.
- O único SQL commitado é **no-op** (P1).
- Não tocou em engine/edge/UI; não fez deploy/flag/cutover.

## Decisão
**Curation Upsert SQL Generator = ACCEPT** — 8/8 cenários PASS; modo `production` bloqueado; `staging`
exige ack humano; no-op seguro por padrão; SCHEMA_GAP reportado; escaping correto.
