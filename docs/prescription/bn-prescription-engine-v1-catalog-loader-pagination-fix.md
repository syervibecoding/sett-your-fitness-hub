# Fix de Paginação do Loader de Catálogo (BN Prescription Engine v1)

> **ORDEM 044.** Corrige o `loadExerciseCatalog` da edge para carregar **TODOS** os exercícios
> disponíveis (pool de candidatos), removendo o teto fixo de 700 via paginação segura. **Sem deploy,
> sem flag, sem cutover, sem alteração de banco/UI/PDF.**

## 1. Resumo executivo
- **Problema:** `loadExerciseCatalog` tinha `.limit(700)`; a biblioteca já tem **749** exercícios →
  até ~49 exercícios (os ordenados por último em `muscle_group, name`) **nunca chegavam** ao engine.
- **Risco:** parte do catálogo real **invisível** para a prescrição (contraria "usar todos os disponíveis").
- **Correção:** paginação via `range()` (page size 1000) recriando a query por página até a biblioteca
  acabar; sem teto fixo antigo.
- **Status: ACCEPT_WITH_NOTES** (correção aplicada e testada offline; `deno check` pendente — Deno indisponível localmente).

## 2. Antes
- Arquivo: `supabase/functions/ai-prescribe-workout/index.ts`, `loadExerciseCatalog`.
- Query única em `exercise_library` com **`.limit(700)`** (linha ~289), `.order(muscle_group).order(name)`,
  filtro `is_global OR company_id`.
- Total atual da biblioteca: **749** > 700 → corte efetivo.
- `exercise_muscle_targets` e `exercise_metadata`: carregados por `selectByExerciseIdChunks` (chunks de 80
  **ids**), **sem** limite de linhas — não cortavam catálogo (só dependem dos ids já carregados).

## 3. Depois
- Helper local `makeExerciseLibraryQuery(from, to)` recria a query por página (Supabase builder não é
  reutilizável após executar) preservando **select**, **order** e **filtro multi-tenant**.
- Loop pagina com `CATALOG_PAGE_SIZE = 1000` via `.range(from, to)` e **acumula** páginas até uma página
  vir com `length < CATALOG_PAGE_SIZE` (ou vazia).
- **Sem teto fixo antigo** → todos os 749 (e além) podem ser carregados.
- **Tratamento de erro preservado** (mesma mensagem `Falha ao carregar biblioteca de exercicios: …`).
- **Fallback preservado:** `buildEmergencyFallbackPlan` continua e só atua quando Anthropic falha;
  catálogo vazio segue degradando para blocker/fallback seguro.
- **targets/metadata:** sem mudança (já sem limite de linhas).

## 4. Segurança
- **Sem deploy.** **Sem flag ON.** **Sem cutover.** **Sem alteração de banco** (nenhum SQL de escrita).
- **Sem alteração de UI/PDF/publicação.**
- **Anthropic + `buildEmergencyFallbackPlan` preservados**; resposta `{ id: planId, plan: planJson }` intacta.
- Metodologia do engine **inalterada**; flag `PRESCRIPTION_ENGINE_V1` segue default `off`.
- Única edição: o bloco do loader de catálogo dentro de `index.ts`.

## 5. Testes
Adicionado: `src/lib/prescription/catalog-loader-contract.test.ts` (estático, lê o `index.ts`):
1. não contém `.limit(700)` · 2. usa `range()` em `loadExerciseCatalog` · 3. existe `CATALOG_PAGE_SIZE` ·
4. nenhum `.limit(<1000)` e page size ≥ 1000 · 5. `buildEmergencyFallbackPlan` presente ·
6. Anthropic presente · 7. resposta `{ id: planId, plan: planJson }` intacta · 8. flag default `off` ·
9/10. sem cutover (`engineFlag === "shadow"` preservado; sem `planJson = enginePlan`) · paginação acumula e para por página incompleta.

Comandos rodados:
- `npm run test -- src/lib/prescription` → **106/106** (10 novos do contrato).
- `npm run test` (completo), `npm run build`, `npx tsc --noEmit` → ver relatório de execução final.

## 6. Pendências
- **`deno check supabase/functions/ai-prescribe-workout/index.ts`**: **PENDENTE** — Deno indisponível
  localmente (não foi instalado nada). Rodar no runtime Deno antes de qualquer deploy.
- **Shadow real** continua **bloqueado** por metadata vazia (`exercise_metadata` = 0).
- **catalog_delta** (534 fora do manifesto) ainda precisa de **revisão humana** (ORDEM 043).

## 7. Decisão
- **Catalog Loader Full Coverage = ACCEPT_WITH_NOTES** (paginação OK; `deno check` pendente).
- **Deploy = NOT_AUTHORIZED**
- **Flag ON = NOT_AUTHORIZED**
- **Cutover = NOT_AUTHORIZED**
