# Checklist de Reauditoria Pós-Aplicação — Curadoria da Biblioteca (v1)

> **ORDEM 037.** Checklist para conferir o estado da biblioteca **depois** de uma aplicação em staging
> (ou rollback), **antes** de qualquer shadow diagnóstico. **Nada aplicado por este checklist.**

## 1. Quando usar
- **Depois** de uma aplicação em staging (por lote: P1, depois P2, depois P3).
- **Depois** de qualquer **rollback**.
- **Antes** de considerar **shadow diagnóstico**.

## 2. Comandos / documentos
- Rodar **`docs/prescription/bn-prescription-engine-v1-library-metadata-audit.sql`** (em staging, read-only).
- **Registrar os resultados** (salvar saída com timestamp).
- **Comparar** com o relatório anterior (`bn-prescription-engine-v1-library-metadata-audit-results.md`).
- Rodar **validadores/builders** (sanidade do approved manifest aplicado):
  ```bash
  node scripts/prescription/validate-curation-review-board.mjs --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv --review <csv-revisado> --expect-priority <P1|P2|P3>
  node scripts/prescription/build-approved-curation-manifest.mjs --manifest docs/prescription/library-curation-v1-consolidated-manifest.csv --review <csv-revisado> --expect-priority <P1|P2|P3> --out <approved.csv> --report <report.md>
  ```
- Rodar **testes locais**:
  ```bash
  npm run test -- src/lib/prescription
  npm run test
  npm run build
  ```

## 3. Métricas obrigatórias (antes/depois)
| Métrica | Antes | Depois | Meta |
|---|---|---|---|
| `exercise_metadata` total | 0 | _____ | **> 0** |
| Alto risco **sem** contraindications | 20 | _____ | **0** (ou justificado) |
| Pain tags **joelho** | _____ | _____ | cobertura mínima |
| Pain tags **lombar** | _____ | _____ | cobertura mínima |
| Pain tags **ombro** | _____ | _____ | cobertura mínima |
| `substitutes` / `regressions` / `progressions` preenchidos | _____ | _____ | crescente |
| `equipment` (exercise_library) | ausente | _____ | suficiente |
| Padrões essenciais com **≥3 seguros** | 0 | _____ | **9/9** |
| `status_sugerido` | `BLOCKED_FOR_SHADOW` | _____ | `ACCEPT_WITH_NOTES`/`ACCEPT` |

## 4. Gates
- **PASS** — todas as metas atingidas; auditoria sem `BLOCKED_FOR_SHADOW`.
- **PASS_WITH_NOTES** — melhora clara, mas ainda há ressalvas (ex.: P2/P3 pendentes).
- **FAIL** — métricas não melhoraram, ou apareceu regressão/inconsistência.

## 5. Decisão
- Se **FAIL** → **não avançar**; investigar, possivelmente rollback, devolver ao revisor.
- Se **PASS_WITH_NOTES** → **shadow diagnóstico pode ser considerado** (com autorização ATENA e flag default off).
- Se **PASS** → **preparar autorização ATENA** para o próximo passo.

## 6. Não fazer
- **Não mascarar blocker.**
- **Não remover tags conservadoras** só para passar.
- **Não ligar shadow/cutover automaticamente.**
- **Não fazer deploy sem ordem.**
