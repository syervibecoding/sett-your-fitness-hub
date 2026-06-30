# Codex Full Prescription Stack Review

Data: 2026-06-30  
Branch auditada: `codex/claude-compat`  
Repo: `sett-your-fitness-hub`  
Supabase esperado: `zshrcgbyhzxpnlccssyz`

## 1. Resumo executivo

Status final: `ACCEPT_WITH_FIXES`

O stack de prescrição foi auditado de ponta a ponta sem promover o BN Prescription Engine v1 para produção, sem ativar flags, sem deploy e sem alteração de banco. O caminho principal da edge `ai-prescribe-workout` continua preservado: LLM quando disponível, `buildEmergencyFallbackPlan` como fallback, response `{ id, plan }`, validação antes do insert e shadow do engine desligado por padrão.

Correção aplicada nesta rodada: adicionei uma guarda estática offline para cobrir o buraco deixado pela ausência local do `deno`, validando imports Deno-safe, feature flag desligada, shadow não-mutante, paginação do catálogo, ausência de `.limit(700)` e preservação do contrato `{ id, plan }`.

Principais pendências antes de qualquer cutover real:

- `deno check` não pôde rodar porque `deno` não está instalado nesta máquina.
- Consulta live ao Supabase não pôde ser confirmada porque o projeto local não está linked e a publishable key local retornou `Invalid API key`.
- A curadoria humana segue com `approved_rows=0`; nenhum upsert deve ser aplicado.
- O catálogo live documentado tem 749 exercícios, mas os metadados continuam pendentes de aprovação/curadoria.

## 2. Escopo auditado

- BN Prescription Engine v1 em `supabase/functions/_shared/prescription/**` e shims em `src/lib/prescription/**`.
- Edge `supabase/functions/ai-prescribe-workout/index.ts`.
- Fallback `buildEmergencyFallbackPlan`.
- Contrato de resposta usado por UI/PDF/publicação.
- Carregamento do catálogo `exercise_library`.
- Shadow mode, flag `PRESCRIPTION_ENGINE_V1` e logs de comparação.
- Pipeline de curadoria/review/outbox em `docs/prescription/**` e `scripts/prescription/**`.
- Testes unitários e invariantes.
- Relatórios de periodização externa feitos enquanto Codex estava ausente.

Fora do escopo por regra da ATENA: deploy, cutover, alteração de flags, migrations, alterações estéticas/UI, aprovação humana de curadoria e alteração do contrato `{ id, plan }`.

## 3. Commits revisados

Todos os commits citados no brief foram encontrados na branch:

`dcb2d52`, `20e0448`, `3eb24b4`, `9000d95`, `2fd7dcf`, `ee4bfbe`, `469ce66`, `c60affd`, `d4c7486`, `4b9a8bc`, `b917bb2`, `f1c15bd`, `75b46dc`, `c7294c8`, `3a6f433`, `87ec342`, `10df66e`, `f743961`, `0e54a75`, `de3d0f5`, `31aa4e9`, `c6168d5`.

Também foram vistos commits posteriores relacionados ao mesmo stack: `f676ff9`, `670c7f8`, `e1e1b90`, `8bd9a9f`, `a76f398`, e commits de documentação posteriores até o HEAD inicial da auditoria.

## 4. Mudanças fora da lane Codex/Claude

O working tree estava limpo no início da auditoria. Não encontrei alterações uncommitted pré-existentes.

Observações de risco:

- O path citado no brief como `review-outbox/v1` não existe na raiz. O caminho canônico existente é `docs/prescription/review-outbox/v1`.
- As mudanças externas de periodização foram documentadas como display-only. Elas não alteram a edge, o engine, o PDF ou a publicação, mas podem mostrar linguagem de periodização avançada em tela sem ainda passar pelo gate completo do engine.

## 5. Testes e comandos executados

| Comando | Resultado |
| --- | --- |
| `npm run test -- src/lib/prescription` | PASS, 9 files, 120 tests |
| `npm run test` | PASS, 16 files, 160 tests |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `node scripts/prescription/test-curation-review-pipeline.mjs` | PASS, 15/15 |
| `node scripts/prescription/test-curation-review-return-guard.mjs` | PASS, 12/12 |
| `node scripts/prescription/test-curation-review-return-pipeline.mjs` | PASS, 4/4 |
| `node scripts/prescription/run-curation-review-return-pipeline.mjs ... P1` | PASS, noop, approved 0, ready 0 |
| `node scripts/prescription/run-curation-review-return-pipeline.mjs ... P2` | PASS, noop, approved 0, ready 0 |
| `node scripts/prescription/run-curation-review-return-pipeline.mjs ... P3` | PASS, noop, approved 0, ready 0 |
| `node scripts/prescription/check-deno-safety.mjs` | PASS, 36/36 |
| `deno check ...` | BLOCKED: `deno` command not found |

Build observou apenas warnings conhecidos de tooling: `caniuse-lite` antigo e chunks acima de 500 kB.

## 6. Deno e segurança de edge

`deno check` real ficou bloqueado por ausência do binário local. Para não deixar essa blindagem só no verbal, foi criado:

- `scripts/prescription/check-deno-safety.mjs`
- `docs/prescription/bn-prescription-engine-v1-deno-static-guard-report.md`

Cobertura da guarda estática:

- Sem imports `@/` nos arquivos de edge/shared auditados.
- Imports relativos de `_shared/prescription` usam `.ts`.
- Sem imports React, Node, npm/http ou DOM/browser APIs nos módulos compartilhados.
- `PRESCRIPTION_ENGINE_V1` permanece default `off`.
- Shadow só roda quando `shadow` ou `on`.
- Shadow não usa `prescricao_shadow` como source de log.
- Shadow identifica `payload.kind = "shadow_comparison"`.
- Loader de catálogo usa paginação.
- `.limit(700)` não existe mais no loader de catálogo.
- `buildEmergencyFallbackPlan` e `ANTHROPIC_API_KEY` continuam preservados.
- A resposta da edge continua `{ id, plan }`.
- Não há atribuição do engine para `planJson`.

Resultado: `PASS checks=36/36`.

## 7. Engine, fallback e contrato

Status: `ACCEPT`

O engine v1 está implementado como módulos puros em `_shared/prescription`, com shims em `src/lib/prescription`. Os testes cobrem os Golden Cases, regras inegociáveis, contrato PDF/portal, adapters, shadow e invariantes de edge.

O engine ainda não foi promovido para caminho principal. Isso está correto para a fase atual.

Pontos confirmados:

- `buildEmergencyFallbackPlan` segue intacto e referenciado.
- O caminho com Anthropic/OpenAI não foi removido.
- O contrato `TrainingProgram` permanece aditivo.
- O contrato externo da edge continua `{ id, plan }`.
- O shadow não altera `planJson` nem a resposta da edge.
- Validação pré-salvar bloqueia antes do insert quando `preSaveValidation.status === "blocked"`.

## 8. Edge `ai-prescribe-workout`

Status: `ACCEPT_WITH_NOTES`

Pontos bons:

- Flag `PRESCRIPTION_ENGINE_V1` default `off`.
- Shadow isolado e não-mutante.
- Logs usam `source: "prescricao"` com `payload.kind = "shadow_comparison"`, evitando depender de novo enum/source.
- Carregamento do catálogo usa paginação de 1000 em 1000.
- Não encontrei `.limit(700)` no loader atual.

Notas:

- Como `deno check` real não rodou, a validação Deno ficou por guarda estática e testes Node/Vitest.
- Sem credencial válida local, não confirmei o comportamento contra dados live do Supabase.

## 9. Catálogo live e cobertura

Status: `ACCEPT_WITH_NOTES`

Não foi possível confirmar live diretamente nesta máquina:

- `supabase db query --linked` falhou com `Cannot find project ref. Have you run supabase link?`
- Consulta via Supabase JS com publishable key local falhou com `Invalid API key`.
- Não usei nem procurei service role.

Últimos números documentados nos relatórios do repo:

- Catálogo live documentado: 749 exercícios.
- Baseline antigo: 447 exercícios.
- Delta observado: +302 exercícios vs baseline.
- Exercícios fora do manifesto consolidado antigo: 534.
- Outbox documentado cobre 749 exercícios: 215 core + 534 delta.
- Exercícios sem metadata documentados: 749.
- Exercícios sem equipment documentados: 447.

Conclusão: o loader runtime já está preparado para mais de 700 registros, mas a qualidade dos metadados depende da curadoria humana.

## 10. Curadoria, outbox e manifests

Status: `ACCEPT_WITH_NOTES`

O outbox canônico está em `docs/prescription/review-outbox/v1`.

Arquivos-chave verificados:

| Arquivo | SHA-256 |
| --- | --- |
| `docs/prescription/review-outbox/v1/review-outbox-manifest.json` | `68e168a45e1c8ac3b82f9b01ccd966806123c3f305f307a5c9ecfc4baa61d6f5` |
| `docs/prescription/review-outbox/v1/outbox-final-qa-report.md` | `07106d8051881c38f612e03db969e307692f8818104877f2264fc1fe0c55f3cc` |
| `docs/prescription/review-outbox/v1/p1-core-human-review.csv` | `6005900d2b5fdd2c3b828dc0f4aa0769a444cfe1f8404b52c76e2647011be3ff` |
| `docs/prescription/review-outbox/v1/p1-catalog-delta-human-review.csv` | `7e0ca565e612c9dcbd835d70d2312f124c29b2986e35416b25a9094f6abe4f62` |
| `docs/prescription/review-outbox/v1/p2-core-human-review.csv` | `6148e4122ed0ea17ff343d0d2bb918ef91f5c7dedd4a9bfeaf68b72032ed8bbf` |
| `docs/prescription/review-outbox/v1/p2-catalog-delta-human-review.csv` | `164332f5f0da1f5fe3833f050bd0f60850c26b8b0a875438b557f2ee96d7ccdc` |
| `docs/prescription/review-outbox/v1/p3-core-human-review.csv` | `b0a844e08c3716d596b7bd5386103a113e468a7a1c13ba7e880018f8a545a56d` |
| `docs/prescription/review-outbox/v1/p3-catalog-delta-human-review.csv` | `b180d7014a2f6d3eef4271c21d9e97fd23b32667d38feec957d81739d871da40` |

Retorno de review:

- P1: approved 0, ready 0.
- P2: approved 0, ready 0.
- P3: approved 0, ready 0.
- Upsert SQL gerado em modo noop.
- Nenhum SQL produtivo foi gerado ou aplicado.

## 11. Periodização externa

Status: `ACCEPT_WITH_NOTES`

Relatórios consultados:

- `docs/prescription/bn-prescription-engine-v1-external-prompt-risk-report.md`
- `docs/prescription/bn-prescription-engine-v1-periodization-extension-plan.md`

Conclusão:

- O trabalho externo de periodização é display-only.
- Não mexe em `ai-prescribe-workout`, engine, fallback, PDF ou publicação.
- Risco residual: a UI pode exibir termos como `choque` e RIR 1-2 sem gate de dor/nível do engine. Isso deve ser tratado em uma fase futura de integração, não nesta auditoria.

## 12. Correções feitas nesta rodada

Arquivos criados:

- `scripts/prescription/check-deno-safety.mjs`
- `docs/prescription/bn-prescription-engine-v1-deno-static-guard-report.md`
- `docs/prescription/codex-full-prescription-stack-review.md`
- `docs/prescription/library-curation-v1-p2-return-pipeline-report.md`
- `docs/prescription/library-curation-v1-p3-return-pipeline-report.md`
- `docs/prescription/library-curation-v1-approved-manifest-p2-upsert.noop.sql`
- `docs/prescription/library-curation-v1-approved-manifest-p3-upsert.noop.sql`

Arquivos atualizados por reexecução de pipeline noop:

- `docs/prescription/library-curation-v1-p1-return-pipeline-report.md`
- `docs/prescription/library-curation-v1-approved-manifest-p1-upsert.noop.sql`

Nenhuma edge, UI, migration, flag ou contrato de produção foi alterado.

## 13. Blockers e recomendações

Blockers para cutover:

- Instalar/disponibilizar `deno` e rodar `deno check` real nas functions antes de deploy/cutover.
- Corrigir credenciais locais ou usar ambiente controlado para conferir catálogo live no Supabase `zshrcgbyhzxpnlccssyz`.
- Curadoria humana precisa aprovar linhas antes de qualquer upsert de metadata.
- Não ativar `PRESCRIPTION_ENGINE_V1=on` sem uma fase específica de shadow acceptance com dados reais.

Recomendações:

- Manter `PRESCRIPTION_ENGINE_V1=off` até o Claude/ATENA autorizar shadow/cutover.
- Se ativar shadow futuramente, monitorar logs `source="prescricao"` + `payload.kind="shadow_comparison"`.
- Tratar a periodização display-only com um adapter/gate antes de aproximá-la do engine principal.
- Manter o outbox em `docs/prescription/review-outbox/v1` ou ajustar docs/scripts que mencionem o path raiz.

## 14. Decisão por área

| Área | Decisão |
| --- | --- |
| Engine v1 core | `ACCEPT` |
| Golden tests e regras inegociáveis | `ACCEPT` |
| Fallback atual | `ACCEPT` |
| Edge `ai-prescribe-workout` | `ACCEPT_WITH_NOTES` |
| Shadow mode | `ACCEPT_WITH_NOTES` |
| Contrato `{ id, plan }` | `ACCEPT` |
| Loader de catálogo | `ACCEPT` |
| Catálogo live | `ACCEPT_WITH_NOTES` |
| Curadoria/outbox | `ACCEPT_WITH_NOTES` |
| Metadata pronta para produção | `BLOCKED` |
| Periodização externa | `ACCEPT_WITH_NOTES` |
| Deploy/flag/cutover | `BLOCKED` por regra da ATENA |

## 15. Conclusão

O stack está coerente e testado para permanecer em modo seguro. A Fase A/stack atual pode seguir para auditoria do Claude, mas ainda não deve ser promovida para produção nem shadow real sem resolver os blockers de `deno`, credenciais live e curadoria humana.

