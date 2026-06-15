# BN Prescription Engine v1 — Aceitação do B1 (Deno-safe shared engine)

## 1. Resumo executivo

**Status: `ACCEPT_WITH_NOTES`**

Motivo:
- B1 passou em **`tsc --noEmit` (exit 0)**, **`npm run test` (83/83)** e **`npm run build` (ok)**.
- A **fonte única** do engine foi movida/preparada em `supabase/functions/_shared/prescription/` (Deno-safe).
- `src/lib/prescription/**` virou **shim / re-export** (API pública preservada).
- O **comportamento da edge continua intocado** (a edge não importa o engine novo).
- **Nota pendente:** `deno check` **não rodou** porque o **Deno não está disponível localmente** —
  validação no runtime Deno/Supabase fica como pendência para Codex/CI.

---

## 2. Commit auditado

| Commit | Mensagem |
|---|---|
| `4b9a8bc` | claude: add deno safe prescription shared engine |

---

## 3. Arquitetura entregue

- **Fonte única:** `supabase/functions/_shared/prescription/` — os 10 módulos puros do engine
  (`engine, types, methodology, presets, exerciseScoring, restrictionRules, volumeRules,
  progressionRules, validator, explanations`), com **imports relativos Deno-safe** (extensão `.ts`),
  sem alias `@/`, sem React/DOM/Node, sem dependências externas.
- **Preservação da API pública:** cada arquivo de `src/lib/prescription/**` virou um **re-export fino**
  (`export * from "../../../supabase/functions/_shared/prescription/<mod>.ts"`). Qualquer consumidor de
  `@/lib/prescription/*` (hoje apenas os testes) continua funcionando sem alteração. Confirmado: nenhum
  `export default` no engine, então `export *` cobre todos os símbolos.
- **Como o drift foi evitado:** **não há duplicação de lógica** — `src/lib` apenas re-exporta a fonte
  única em `_shared`. A viabilidade vem de `allowImportingTsExtensions: true` (já presente em
  `tsconfig.app.json`), que permite ao front compilar imports com extensão `.ts`.
- **Guard/teste de fonte única:** `src/lib/prescription/shared-source.test.ts` afirma
  `Object.is(viaShim, viaShared) === true` para `generateTrainingProgram` e `getVolumeRangeForGroup`
  → prova que o caminho antigo re-exporta **exatamente a mesma referência** do `_shared` (zero drift).
- **Duplicação?** **Não.** Fonte única + shims. (Sem necessidade de "teste de diff de cópias".)

---

## 4. Arquivos tocados pelo B1

**Criados — `supabase/functions/_shared/prescription/` (10):**
`engine.ts`, `types.ts`, `methodology.ts`, `presets.ts`, `exerciseScoring.ts`, `restrictionRules.ts`,
`volumeRules.ts`, `progressionRules.ts`, `validator.ts`, `explanations.ts`.

**Alterados — `src/lib/prescription/` (10 shims):**
os mesmos 10 nomes acima, agora como `export *` da fonte em `_shared`.

**Testes adicionados:**
`src/lib/prescription/shared-source.test.ts` (guard de fonte única).
`src/lib/prescription/engine.test.ts` **não foi alterado** (continua 41 testes, importando via shims).

**Configs tocadas:** **nenhuma.** `tsconfig*`, `vite.config.ts`, `vitest.config.ts` **não foram editados**
(o `allowImportingTsExtensions` já existia).

---

## 5. Verificações de import (reconfirmadas ao vivo)

| Verificação | Resultado |
|---|---|
| `ai-prescribe-workout/index.ts` importa o engine novo? | **NÃO** (grep vazio por `_shared/prescription`/`lib/prescription`/`generateTrainingProgram`/`TrainingProgram`) |
| `buildEmergencyFallbackPlan` intacto? | **Sim** (presente, não tocado) |
| Feature flag nova? | **Não** (`PRESCRIPTION_ENGINE_V1` inexistente) |
| Shadow mode? | **Não** |
| Adapter novo (input/output/catalog)? | **Não** |
| Migration? | **Não** |
| Deploy? | **Não** |
| Quem consome `_shared/prescription`? | **Apenas** os 10 shims de `src/lib/prescription` + `shared-source.test.ts` (nenhuma edge function) |

---

## 6. Comandos rodados

- `npx tsc --noEmit`
- `npm run test -- src/lib/prescription`
- `npm run test`
- `npm run build`
- `deno check` → **NÃO executado**: Deno indisponível localmente (`command -v deno` → ausente).
  **Não** foi tentada nenhuma instalação. Marcado como **pendência para Codex/CI**.

---

## 7. Resultado dos comandos

| Comando | Resultado | Observações |
|---|---|---|
| `npx tsc --noEmit` | ✅ exit 0 | imports `.ts` cross-folder typecheck limpo (`allowImportingTsExtensions`) |
| `npm run test -- src/lib/prescription` | ✅ **43/43** | 41 engine + 2 do guard de fonte única |
| `npm run test` | ✅ **83/83** (9 arquivos) | era 81; +2 do guard |
| `npm run build` | ✅ ok | só warning de chunk-size pré-existente |
| `deno check ..._shared/prescription/engine.ts` | ⏳ **não rodou** | Deno indisponível → pendência Codex/CI |

---

## 8. Riscos residuais

- **`deno check` pendente:** o engine em `_shared` é Deno-safe por construção (extensões `.ts`, sem
  imports externos, usa só `crypto.randomUUID`/`Date` — globais no Deno) e compila sob o `tsc` do front,
  mas **não foi validado no runtime Deno real**. Rodar `deno check supabase/functions/_shared/prescription/engine.ts` no Codex/CI.
- **Imports com extensão `.ts`** precisam ser validados no **runtime Supabase Edge** (Deno) — não só no Vite/tsc.
- **Front importando de `_shared` via shim** precisa **continuar verde** a cada mudança no engine
  (o guard `shared-source.test.ts` protege contra drift; manter no CI).
- **Path relativo** (`../../../supabase/functions/_shared/prescription`) é frágil a movimentação de pastas;
  ao adicionar B2/B3/B4 (adapters), preferir manter os adapters próximos do `_shared`/edge e não criar
  novas dependências cruzadas a partir de `src/`.

---

## 9. Decisão

- **B1 = `ACCEPT_WITH_NOTES`** (verde em tsc/test/build + guard de fonte única; única nota = `deno check` pendente).
- **B2/B3/B4 = podem ser preparados como adapters puros**, **sem edge wiring** (sem importar o engine na
  edge, sem ligar flag, sem shadow). Idealmente na lane do Codex (dono de `supabase/functions/**`).
- **Edge cutover = `NOT_AUTHORIZED`.**
- **Deploy = `NOT_AUTHORIZED`.**
