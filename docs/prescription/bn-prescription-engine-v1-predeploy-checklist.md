# BN Prescription Engine v1 — Checklist de Pré-Deploy (LOCAL, sem deploy)

> **Deploy = `NOT_AUTHORIZED`.** Este documento é só preparação: o que precisa estar verde **antes**
> de qualquer deploy da edge `ai-prescribe-workout` (alterada em B5/B6, shadow mode). Nada aqui executa
> deploy, cutover ou liga a flag.

## Contexto
A edge `ai-prescribe-workout/index.ts` ganhou um bloco de **shadow mode** atrás da flag
`PRESCRIPTION_ENGINE_V1` (default **off**). Em `off`/ausente, o comportamento é 100% o anterior. Um
deploy desta edge é necessário em algum momento para o shadow rodar em produção — mas só sob ordem.

## A. Gates de código (LOCAL) — todos ✅ hoje
- [x] `npm run test` verde (**128 testes**).
- [x] `npm run test -- src/lib/prescription` verde (engine + adapters + shadow + contrato PDF/portal).
- [x] `npx tsc --noEmit` exit 0 (front).
- [x] `npm run build` ok.
- [x] Contrato de resposta inalterado: `{ id: planId, plan: planJson }`.
- [x] `buildEmergencyFallbackPlan` presente; Anthropic (`ANTHROPIC_API_KEY`) presente.
- [x] Nenhuma migration adicionada; nenhum arquivo de UI/PDF/publicação alterado.
- [x] Contrato PDF/publicação/portal verificado contra plano real do engine (ORDEM 016).

## B. Gates de runtime Deno (PENDENTES — bloqueiam o deploy da edge)
- [ ] **`deno check supabase/functions/ai-prescribe-workout/index.ts`** — **NÃO rodou** (Deno indisponível local).
- [ ] `deno check supabase/functions/_shared/prescription/engine.ts`
- [ ] `deno check supabase/functions/_shared/prescription/shadow.ts`
- [ ] `deno check supabase/functions/_shared/prescription/adapters/*.ts`
- [ ] (opcional) `supabase functions serve ai-prescribe-workout` localmente para smoke test.
> Estes são **bloqueadores** de deploy da edge: como o Vitest/tsc do front não compila a edge Deno, a
> validação real dos imports `.ts`/dynamic import só acontece no Deno. Rodar no Codex/CI antes de deploy.

## C. Configuração de ambiente (no momento do deploy)
- [ ] Projeto Supabase correto: **`zshrcgbyhzxpnlccssyz`** (Bn-app) — confirmar antes de qualquer deploy.
- [ ] **`PRESCRIPTION_ENGINE_V1`** NÃO definido (ou `off`) no ambiente de destino → comportamento atual preservado.
- [ ] Para ligar shadow (futuro, sob ordem): setar `PRESCRIPTION_ENGINE_V1=shadow` **só** após os gates B + B8.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` disponível na function (já usado hoje) — o log shadow grava via service_role.
- [ ] `ai_decision_logs` aceita insert por service_role com `source='prescricao'` (CHECK ok; sem migration).

## D. Comando de deploy (DOCUMENTADO — NÃO executar agora)
```
# Somente sob ordem explícita do orquestrador, após gates B e B8:
supabase functions deploy ai-prescribe-workout --project-ref zshrcgbyhzxpnlccssyz --use-api
# (no sandbox deste ambiente exigiria dangerouslyDisableSandbox; ver memória do projeto)
```
> O deploy sobe **só a edge** (a flag default off → sem mudança de comportamento ao aluno). **Frontend
> Netlify NÃO está envolvido** nesta mudança (nenhum arquivo de UI alterado) — o gotcha do `.env`
> (`zshrcg` vs ref morta) não se aplica aqui, mas continua valendo para qualquer deploy de frontend.

## E. Rollback
- **Mais simples:** manter/voltar `PRESCRIPTION_ENGINE_V1=off` (rollback por config, sem redeploy) →
  edge volta ao comportamento atual imediatamente.
- **Se necessário:** redeploy da versão anterior da function (commit pré-`b917bb2`).
- Risco de rollback é baixo: em `off` o bloco shadow nem executa.

## F. Quem autoriza / executa
- **Deploy da edge:** só sob **ordem explícita do orquestrador**; idealmente executado/validado pelo
  **Codex** (dono de `supabase/functions/**`) após `deno check`.
- **Ligar shadow em produção:** etapa separada (observação), também sob ordem.
- **Cutover (`on` servindo o plano do engine):** `NOT_AUTHORIZED` — depende do checklist B8 (shadow com
  amostra real, 0 exercício inventado, caps/handoff preservados, PDF/portal ok, rollback testado, revisão Codex).

## Status
- Gates A (local): ✅ completos.
- Gates B (Deno): ⏳ pendentes (Deno indisponível aqui).
- Deploy/cutover/flag ON: **NOT_AUTHORIZED**.
