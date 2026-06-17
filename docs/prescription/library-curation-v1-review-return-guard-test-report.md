# Relatório — Testes do Return Guard (Curadoria v1)

> **ORDEM 038.** Testes **offline** do `scripts/prescription/check-curation-review-return.mjs`, via
> `scripts/prescription/test-curation-review-return-guard.mjs`, com fixtures **temporárias** em
> `os.tmpdir()` (removidas ao final, **não commitadas**). **Sem banco, sem SQL, sem deploy.**

## Resumo executivo
**Return Guard Tests = PASS** — **12/12** cenários passaram (harness exit 0). Fixtures temporárias
removidas (`tmp removido: true`). Nada executado no banco.

## Cenários
| # | Cenário | Esperado | Observado | Status |
|---|---|---|---|---|
| 1 | `unchanged_file_passes` | PASS (exit 0) | exit=0 | **PASS** |
| 2 | `allowed_reviewer_fields_change_passes` | PASS (exit 0) | exit=0 | **PASS** |
| 3 | `exercise_id_changed_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 4 | `exercise_name_changed_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 5 | `max_priority_changed_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 6 | `row_removed_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 7 | `row_added_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 8 | `duplicate_id_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 9 | `invalid_status_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 10 | `applied_status_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 11 | `ready_true_without_approved_fails` | FAIL (exit 1) | exit=1 | **PASS** |
| 12 | `wrong_priority_for_expected_fails` | FAIL (exit 1) | exit=1 | **PASS** |

**TOTAL: 12 | PASS: 12 | FAIL: 0**

## Relatórios P1/P2/P3 (sent == returned, arquivos atuais)
| Pacote | Resultado | protected changes | added | removed | duplicate ids | errors |
|---|---|---|---|---|---|---|
| P1 | **PASS** | 0 | 0 | 0 | 0 | 0 |
| P2 | **PASS** | 0 | 0 | 0 | 0 | 0 |
| P3 | **PASS** | 0 | 0 | 0 | 0 | 0 |

## Segurança
- Fixtures **temporárias** (`os.tmpdir()`), **removidas** ao final e **não commitadas**.
- **Não** conectou no Supabase; **nenhum SQL executado**; **nenhum banco alterado**.
- O guard **não** aprova linha, **não** gera SQL, **não** faz deploy.
- Não tocou em engine/edge/UI; deploy/flag/cutover seguem proibidos.

## Decisão
**Return Guard = ACCEPT** — 12/12 cenários PASS; P1/P2/P3 atuais PASS sem alterações.
