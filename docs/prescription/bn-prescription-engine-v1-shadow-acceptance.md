# BN Prescription Engine v1 — Aceitação do Shadow Mode (B5/B6) + Hardening (B7)

## 1. Status

**B5/B6 = `ACCEPT_WITH_NOTES`**

Shadow mode + feature flag implementados na edge `ai-prescribe-workout` com **default seguro OFF**.
A lógica pura (parse da flag + comparação) vive em `_shared/prescription/shadow.ts` e é testada no
Vitest; a parte que vive na edge Deno é coberta por **contract tests estáticos** (leitura do arquivo).

## 2. Commit auditado

| Commit | Mensagem |
|---|---|
| `b917bb2` | claude: add prescription engine shadow mode |

Pré-condição **B2/B3/B4 confirmada**: adapters em `_shared/prescription/adapters/` commitados em
`2cd4652` + testes em `a817b4f`.

## 3. Comportamento da flag `PRESCRIPTION_ENGINE_V1`

| Valor | Roda engine novo? | Altera a resposta `{id, plan}`? | Grava log shadow? | Pode ir para produção? |
|---|---|---|---|---|
| **off** | Não (nem importa) | Não | Não | **Sim** — é o estado atual/seguro |
| **ausente** | Não | Não | Não | **Sim** (equivale a off) |
| **inválida** | Não | Não | Não | **Sim** (resolve para off) |
| **shadow** | Sim (em paralelo) | **Não** (resposta inalterada) | Sim (`ai_decision_logs`) | Só sob autorização (observação; **NOT_AUTHORIZED** agora) |
| **on** | Sim (roda comparação) | **Não** (sem cutover nesta implementação) | Sim | **Não** — `NOT_AUTHORIZED` |

> `on` é reconhecido no código mas, por decisão de segurança desta fase, **não faz cutover** (não serve
> o plano do engine). O ponto de cutover está comentado como etapa futura/autorizada.

## 4. Matriz dos 20 testes/checks

| # | Check | Tipo | Resultado |
|---|---|---|---|
| 1 | Flag ausente → off | Unit | ✅ PASS |
| 2 | Flag inválida → off | Unit | ✅ PASS |
| 3 | Flag off não chama engine novo | STATIC (edge) | ✅ engine só por `import(...)` dinâmico + guard de flag |
| 4 | shadow monta comparação sem alterar plano principal | STATIC (edge) | ✅ `currentPlan: planJson`, resposta intocada |
| 5 | on reconhecida, mas não serve plano novo | Unit + STATIC | ✅ `resolveEngineFlag("on")="on"`; edge sem `plan: program`/`plan: output` |
| 6 | Erro no shadow não quebra fluxo | STATIC (edge) | ✅ `catch (shadowError)` dedicado (best-effort log) |
| 7 | Log usa source='prescricao' + kind='shadow_comparison' | Unit + STATIC | ✅ constantes + `source: shadow.SHADOW_LOG_SOURCE` |
| 8 | Payload serializável em JSON | Unit | ✅ PASS |
| 9 | Sem dados sensíveis desnecessários | Unit | ✅ nome/restrições/anamnese crus ausentes do payload |
| 10 | Preserva blocker/handoff no resumo novo | Unit | ✅ EVA>5 → handoff_count 1 + blockers no resumo |
| 11 | Mede missing_exercises | Unit | ✅ `[]` com catálogo completo; detecta quando id falta |
| 12 | Mede safe_alternative_unavailable_count | Unit | ✅ ≥1 com catálogo sem substituto seguro |
| 13 | Mede volume_by_group_delta | Unit | ✅ objeto de deltas numéricos |
| 14 | Mede timing_ms | Unit | ✅ PASS |
| 15 | buildEmergencyFallbackPlan presente | STATIC (edge) | ✅ |
| 16 | Anthropic/OpenAI presentes | STATIC (edge) | ✅ `ANTHROPIC_API_KEY` |
| 17 | Nenhuma migration adicionada | STATIC (git) | ✅ `b917bb2` sem migration |
| 18 | Nenhum arquivo UI/PDF/publicação alterado | STATIC (git) | ✅ `b917bb2` = só edge + shadow.ts + teste |
| 19 | Contrato de resposta continua `{ id, plan }` | STATIC (edge) | ✅ `JSON.stringify({ id: planId, plan: planJson })` |
| 20 | off semanticamente igual ao anterior | STATIC (edge) | ✅ bloco guardado por flag; engine só carrega fora de off |

**Total: 20/20** (11 unit PASS + 9 STATIC OK). Os STATIC cobrem o que o Vitest não roda (edge Deno),
por leitura do arquivo — registrados como contract tests.

## 5. Logs de shadow

- **Tabela:** `ai_decision_logs` (sem migration).
- **`source = 'prescricao'`** — o `source` tem `CHECK IN ('prescricao','avaliacao','bnito')`; por isso
  **não** se usa `source='prescricao_shadow'` (seria rejeitado pelo CHECK sem migration).
- **Discriminador:** `payload.kind = 'shadow_comparison'`.
- **Campos do payload:** `kind`, `engine` (`bn_prescription_engine_v1`), `mode` (`shadow|on`),
  `old_engine_summary` {generated_by, split, workouts, status, blockers(códigos), warnings(códigos),
  volume_by_group}, `new_engine_summary` {idem + blocked, handoff}, `diff` {split_changed,
  volume_by_group_delta, blockers_delta, warnings_delta, missing_exercises, safe_alternative_unavailable_count,
  handoff_count}, `timing_ms`, `created_by_edge: true`.

## 6. Segurança

- **Erro no shadow não quebra o fluxo atual:** todo o bloco está em `try/catch`; falha apenas registra um
  log best-effort (e o log de erro também é `try/catch`).
- **O plano atual (IA/fallback) continua sendo o retorno ao aluno:** a resposta segue
  `{ id: planId, plan: planJson }`, intocada.
- **Blocker/handoff do engine novo ficam só no log:** entram em `new_engine_summary`/`diff`, nunca na resposta.
- **Nenhum diagnóstico clínico é gerado:** o shadow apenas compara métricas; o handoff do engine é
  representado como contagem/flag, sem texto clínico.
- **Sem dados sensíveis desnecessários no payload:** só códigos de blocker/warning, contagens, split,
  `generated_by`, volume por grupo e ids de exercício. Nome do aluno, restrições/anamnese crus **não** entram
  (verificado por teste com sentinelas).

## 7. Limitações

- **`deno check` pendente:** Deno indisponível localmente; a edge e o `shadow.ts` (imports Deno `.ts` +
  dynamic import) **não** foram type-checados no runtime Deno. Rodar no Codex/CI.
- **Shadow ainda não rodou em ambiente Supabase real** (flag off em todo ambiente).
- **Sem amostra real de produção** para comparar engine × IA/fallback.
- **`on` não faz cutover** por decisão desta fase.
- **Performance real ainda não medida** (timing_ms só validado em teste unitário).
- **Codex ainda não revisou** o shadow nem o hotfix `ee4bfbe`.

## 8. Decisão

- **B5/B6 = `ACCEPT_WITH_NOTES`**
- **B7 = concluído** (20/20 testes/checks passaram; build + 123 testes + tsc verdes).
- **Cutover = `NOT_AUTHORIZED`**
- **Deploy = `NOT_AUTHORIZED`**
- **Flag ON = `NOT_AUTHORIZED`** (default permanece off em todo ambiente).
