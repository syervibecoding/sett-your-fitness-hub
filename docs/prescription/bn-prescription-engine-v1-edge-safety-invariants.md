# Deno Static Guard + Edge Safety Invariants

> **ORDEM 045 (escopo padrão).** Como `deno check` não roda neste ambiente, adicionamos um **guard
> estático** (Vitest) que lê o fonte da edge `ai-prescribe-workout/index.ts` e trava invariantes de
> segurança para prevenir regressão — **sem alterar a edge, o engine, a UI, o banco ou o comportamento.**

## 1. Objetivo
Garantir, de forma automatizada e barata, que mudanças futuras na edge **não** quebrem invariantes de
segurança já estabelecidos (segredos via ambiente, biblioteca-only, fallback/Anthropic, flag default
off, sem cutover, catálogo paginado completo, bloqueio 422, auth gate). É um **teste de leitura
estática** — não importa o módulo Deno, não conecta no banco, não executa SQL.

## 2. Arquivo
- `src/lib/prescription/edge-safety-invariants.test.ts` (14 invariantes; Vitest; só `node:fs`).

## 3. Invariantes verificadas (14)
| # | Invariante | Como |
|---|---|---|
| 1 | Sem JWT/segredos hardcoded | regex nega `eyJ…`, `sk-…`, `sbp_…` |
| 2 | Service role/URL/Anthropic vêm de `Deno.env.get` | regex exige os 3 `Deno.env.get("…")` |
| 3 | Módulo Deno (usa `Deno.env`; **não** `process.env`) | regex |
| 4 | Biblioteca-only (`only_library_exercises: true` + `pickCatalogExercise(`) | regex |
| 5 | Fallback de emergência presente e catalog-driven (`buildEmergencyFallbackPlan`, `bn_emergency_fallback`) | regex |
| 6 | Anthropic preservado (`ANTHROPIC_API_KEY`) | regex |
| 7 | Flag default **OFF** (`PRESCRIPTION_ENGINE_V1 ?? "off"`) | regex |
| 8 | **Sem cutover** (`engineFlag === "shadow"`; **sem** `planJson = enginePlan`) | regex |
| 9 | Catálogo paginado (`CATALOG_PAGE_SIZE`, `.range(`, **sem** `.limit(700)`) | regex |
| 10 | Nenhum `.limit(<1000)`; page size ≥ 1000 | parse de todos os `.limit(n)` |
| 11 | Contrato `{ id: planId, plan: planJson }` preservado | regex |
| 12 | Shadow logging guardado pela flag + `SHADOW_LOG_SOURCE` (`ai_decision_logs`) | regex |
| 13 | Plano fora da biblioteca é bloqueado (`status: 422`) | regex (sem comentários) |
| 14 | Auth gate preservado (`Unauthorized`) | regex |

## 4. Resultado
**14/14 PASS** (`npm run test -- src/lib/prescription/edge-safety-invariants.test.ts`).

## 5. Segurança / não-alteração
- **Não** editou a edge, o engine, a UI, o PDF/publicação nem o banco.
- **Não** executou SQL; **não** conectou no Supabase.
- **Não** fez deploy; **não** ligou flag; **não** fez cutover.
- Apenas adicionou um teste estático (leitura de arquivo) + este relatório.

## 6. Pendência relacionada
- `deno check supabase/functions/ai-prescribe-workout/index.ts` segue **PENDENTE** (Deno indisponível
  localmente; nada foi instalado). Este guard estático **complementa** (não substitui) o `deno check`,
  que deve rodar no runtime Deno antes de qualquer deploy.

## 7. Decisão
- **Edge Safety Invariants Guard = ACCEPT.**
- **Deploy = NOT_AUTHORIZED · Flag ON = NOT_AUTHORIZED · Cutover = NOT_AUTHORIZED.**
