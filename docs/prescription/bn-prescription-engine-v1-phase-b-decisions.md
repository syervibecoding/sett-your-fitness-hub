# BN Prescription Engine v1 — Decisões Técnicas da Fase B

> Decisões registradas **antes** de qualquer código da Fase B. Nada implementado.
> Referências: `bn-prescription-engine-v1-phase-b-plan.md` (`469ce66`),
> `bn-prescription-engine-v1-phase-b-tickets.md` (`c60affd`),
> `bn-prescription-engine-v1-hotfix-acceptance.md`.
> Estado travado: Fase A = `ACCEPT_PROVISIONAL`; Cutover/Deploy = `NOT_AUTHORIZED`.

---

## 1. Decisão de arquitetura B1 — **Opção A (aprovada)**

**Engine puro Deno-safe em:** `supabase/functions/_shared/prescription/`.

**Motivo:**
- Evita o import direto problemático de `src/lib/prescription` no runtime **Deno** (imports sem extensão
  `.ts`, alias `@/` que o Deno não resolve).
- Cria uma **fonte compartilhável** que a edge `ai-prescribe-workout` consegue importar.
- Permite **adapter fino** na edge (entrada/saída) sobre um core estável.
- Reduz risco de alias `@/` e de imports sem extensão (no `_shared`, tudo é relativo com `.ts`).

**Como fica Deno-safe:** imports relativos com extensão `.ts`, `import type` para tipos, sem alias, sem
APIs Node (o engine usa só `Date`/`crypto.randomUUID`, válidos no Deno edge).

---

## 2. Fonte de verdade (anti-drift) — **Recomendação: Opção A**

Opções avaliadas para evitar divergência entre `src/lib/prescription/**` e
`supabase/functions/_shared/prescription/**`:

| Opção | Descrição | Risco de drift | Veredito |
|---|---|---|---|
| **A** | Mover a **fonte de verdade para `_shared/`**; o front importa dali via alias Vite/Vitest (`@/lib/prescription/*` → `../supabase/functions/_shared/prescription/*`) | **Nenhum** (1 cópia só) | ✅ **Recomendada** |
| B | Manter `src/lib` como fonte e **copiar manualmente** para `_shared` | Alto (cópia manual esquece) | ❌ |
| C | **Duplicar** temporariamente com **teste de drift** (hash/diff) | Médio (guard mitiga, mas há 2 cópias) | ⚠️ só stopgap |

**Justificativa para A no projeto atual:** o engine já é 100% relativo e sem dependências de React/Node
(verificado: `engine.ts`/`types.ts`/`presets.ts`/`methodology.ts`/`volumeRules.ts`/`progressionRules.ts`/
`restrictionRules.ts`/`exerciseScoring.ts`/`explanations.ts`/`validator.ts`). Mover para `_shared` e
repontar o import dos testes (alias) é barato e **elimina o drift de vez**. O Vite resolve `.ts` explícito
sem problema, então a mesma fonte serve front (Vite/Vitest) e edge (Deno). Se a relocação não couber num
único PR, usar **C com teste de drift obrigatório** apenas como ponte e migrar para A em seguida.

**Ação no B1:** relocar para `_shared/`, adicionar alias no `vite.config`/`vitest` para os testes,
manter `engine.test.ts` verde (81/81). Sem mudar comportamento.

---

## 3. Shadow logs — `ai_decision_logs` **serve sem migration** (com 1 ressalva)

Inspeção da migration `20260614002903_add_ai_decision_logs_and_exercise_metadata.sql`:

```
ai_decision_logs: id, company_id, student_id,
  source text NOT NULL CHECK (source IN ('prescricao','avaliacao','bnito')),
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at ...
RLS on; GRANT SELECT authenticated (company-scoped) + master; GRANT ALL service_role.
```

**Respostas:**
- **Suporta shadow sem migration?** **Sim.** O campo **`payload jsonb`** é livre e a edge já escreve com
  `service_role` (bypassa RLS). Dá para gravar todo o comparativo no `payload`.
- **Campo JSON/metadata suficiente?** **Sim** — `payload jsonb` comporta o objeto comparativo inteiro.
- **Dá para registrar tudo?** Sim, no `payload`:
  `{ kind: "shadow_comparison", engine_version, current: {...}, engine: {...},
     volume_by_group, blockers, warnings, nonexistent_exercises, generation_ms,
     split_diff, rate_safe_alternative_unavailable, rate_handoff }`.

**⚠️ Ressalva (importante):** o `source` tem **CHECK** restrito a `('prescricao','avaliacao','bnito')`.
**Não é possível** usar `source='prescricao_shadow'` sem migration (o INSERT seria rejeitado).
→ **Decisão:** no shadow, usar **`source='prescricao'`** + **discriminador no payload**
(`payload.kind='shadow_comparison'`). Isso evita migration agora. (Corrige a sugestão anterior do plano/tickets
que citava `source="prescricao_shadow"`.)

**Recomendação:** **usar `ai_decision_logs` no shadow mode**, `source='prescricao'` +
`payload.kind='shadow_comparison'`, **sem migration**. Uma `source='prescricao_shadow'` dedicada fica como
**decisão pendente** (migration futura, só se o volume de logs exigir separação/consulta dedicada) — **não criar agora**.

---

## 4. Feature flag — decisão registrada

- Variável: **`PRESCRIPTION_ENGINE_V1`** com valores `off` | `shadow` | `on`.
  - (Opcional para rollout gradual: override por empresa `company_ai_config.use_prescription_engine_v1`.)
- **Default = `off`** (fluxo atual IA → fallback).
- **Primeira implementação permitida = `shadow`** (engine roda em paralelo, não afeta resposta; loga em `ai_decision_logs`).
- **`on` só com ordem explícita do orquestrador** (após o checklist de cutover B8).

---

## 5. Limites da próxima implementação (B1–B4 podem ser preparados, MAS)

Permitido preparar B1 (shared engine), B2 (input adapter), B3 (catalog adapter), B4 (output adapter).
**Proibido nesta janela:**
- **Não ligar `on`** (no máximo `shadow`, e só em B5/B6).
- **Não remover** o `buildEmergencyFallbackPlan` (rede final permanece).
- **Não remover a Anthropic/IA** — apenas rebaixar o papel para refino de texto opcional.
- **Não mexer em UI/componentes.**
- **Não fazer deploy** (edge/Netlify).
- **Não criar migration** sem ordem (shadow usa `ai_decision_logs` como está).
- **Não mudar o contrato** PDF/portal/publicação (saída aditiva apenas).

---

## 6. Próxima ordem recomendada

**B1 — preparar o Deno-safe shared engine + teste de drift/import, sem alterar o comportamento da edge.**
Concretamente:
1. Relocar os 10 módulos puros para `supabase/functions/_shared/prescription/` com imports `.ts` + `import type`.
2. Adicionar alias Vite/Vitest para `engine.test.ts` continuar importando a fonte única.
3. Validar: `deno check`/`deno test` no `_shared` verde **e** `npm run test` (front) 81/81.
4. **Não** importar o engine na edge ainda; **não** ligar flag; **não** tocar no fallback.

> Lane: idealmente Codex (dono de `supabase/functions/**`) executa B1 quando voltar; se for autorizado a
> Claude executar, será sob ordem explícita e nova lane temporária (como no hotfix).
