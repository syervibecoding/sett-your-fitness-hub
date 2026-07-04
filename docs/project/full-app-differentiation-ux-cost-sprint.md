# Sprint de Evolução — Diferenciação, UX e Custo

**Data:** 04/07/2026 · **Branch:** `codex/claude-compat` (base `904bfd1`) · **Autor:** Claude (ATENA), ordem autônoma

## 1. Resumo executivo

**Status: ACCEPT_WITH_NOTES.** Sprint focada em transformar dados já existentes em diferencial de
produto: **Central de Atenção** (semáforo + próxima melhor ação com mensagem pronta) para o
professor e **"Por quê deste treino" + semáforo de segurança de dor** para o aluno. Pesquisa
competitiva real (12 players) escrita em doc próprio. Custo operacional documentado — a arquitetura
fallback-first já coloca o custo de IA por aluno/mês em centavos. Motor preservado, zero migration.

## 2. Pesquisa competitiva

Doc completo: `docs/project/competitive-fitness-app-research.md` (12 concorrentes: Trainerize,
TrueCoach, Everfit, My PT Hub, TrainHeroic, PT Distinction, Hevy Coach, FitSW + MFIT, Nexur, BTFIT,
Tecnofit). Achados-chave:
1. **WhatsApp é a lacuna nº 1** — nenhum líder entrega coaching nativo via WhatsApp; o SETT já opera o canal.
2. **IA dos concorrentes é cara e genérica** (add-ons US$33–45/mês para gerar treino com LLM); nosso
   motor determinístico entrega prescrição periodizada a custo ~zero — "IA barata porque decide pouco e explica muito".
3. **Janela de migração BR**: MFIT instável em picos; preço flat em BRL + confiabilidade é ataque direto.

## 3. Diferencial escolhido — "Coach OS" (semáforo + próxima melhor ação)

O que nenhum concorrente pesquisado tem de forma integrada: motor determinístico seguro + explicação
rastreável por regra + fila de atenção operacional que diz ao professor **quem** precisa de contato e
**qual mensagem mandar** (pronta, 1 clique) — e ao aluno **por que** o treino é assim e **o que fazer
com dor** (espelhando a linha vermelha EVA do motor).

## 4. Implementado nesta sprint

| Área | Arquivo | O quê | Impacto |
|---|---|---|---|
| Professor | `AtRiskStudents.tsx` → **Central de Atenção** | Semáforo (🔴 dor/risco, 🟡 renovação), inclui **dor moderada/severa da anamnese** (aluno "ativo" com dor agora aparece), **mensagem pronta copiável** contextual por situação (dor/renovação/sumido/pagamento), ordenação por urgência | Retenção + venda: próxima melhor ação em 1 clique, zero IA |
| Aluno | `WhySafetyCard.tsx` (novo) + `StudentPortal.tsx` | Card **"Por quê deste treino?"**: fase atual em linguagem simples (blocos 1–2/3–4/5–6) + motivo ligado ao objetivo + **semáforo de dor** (🟢 até 3 reduz · 🟡 4–5 pula exercício · 🔴 >5 pare e avise) com botão "Avisar meu treinador" (wa.me pré-preenchido) | Clareza, segurança e confiança; espelha a doutrina do motor sem tocá-lo |
| Custo | `docs/project/app-cost-optimization-report.md` | Auditoria de fontes de custo + guards verificados + backlog | Base para decisões de escala |
| Produto | `docs/project/competitive-fitness-app-research.md` | Pesquisa competitiva com fontes | Posicionamento |

## 5–6. Aluno / Professor — já entregue antes (contexto)

Lotes anteriores desta série já cobriram: hero "Treino de hoje", timer robusto, sparklines, XP
anti-duplo, celebração, guia de aquecimento, BNITO ciente do exercício (aluno); prescrições do mês,
feedback pendente com recomendação, coorte NPS, roadmap de periodização, validações pré-publicação,
status de entrega sent→viewed, versionamento de planos (professor).

## 7. Custo — ver `app-cost-optimization-report.md`

Prescrição/cardio/nutrição determinísticos (≈R$0/uso), refino IA opt-in default off, missão BNITO
cacheada por dia+rota, mensagens de retenção por template local (zero IA). Backlog: code-splitting,
batch de frames na avaliação, painel de uso de IA (migration; gate).

## 8. Periodização visível

Já existente e preservada: `PeriodizationBanner` (microciclos ordinário/choque/regenerativo,
mesociclos base/acumulação/intensificação/polimento) + `PeriodizationRoadmap` no professor. O novo
`WhySafetyCard` traduz a fase em linguagem de aluno **sem** exigir campo novo nem tocar
`periodization_blocks`. Iniciante/dor seguem regidos pelo motor (não alterado).

## 9. Biblioteca / exercícios novos

917 exercícios; catálogo paginado no motor E (desde `05a1a9c`) nas edges auxiliares
`ai-validate-prescription`/`ai-coach-pack` — nenhum `.limit(700)` de código restante. Adapters
preservam `exercise_id`/`name`; curadoria intocada (nada aprovado/aplicado).

## 10. QA

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run test` | ✅ **170/170** (17 arquivos) |
| `npm run build` | ✅ |
| Motor (subset) | ✅ 120/120 (rodado hoje na verificação local) |
| Curadoria pipeline/guard | ✅ 15/15 + 12/12 (rodado hoje) |
| `deno check` 6 edges | ✅ 6/6 (rodado hoje) |
| Preview boot | ✅ landing sem erros de console (hoje); telas novas são autenticadas — validação visual manual recomendada |

## 11. Pendências

- e2e Playwright (browsers não instalados) e auditoria visual autenticada.
- Backlog custo: manualChunks, batch de frames, painel de uso de IA (migration; precisa gate).
- Deploy da edge do motor com o "engine v1" do Codex — **gate do Codex** (prod roda a versão anterior, flags off).

## 12. Riscos

- Mensagens prontas são templates: professor deve personalizar antes de enviar (são ponto de partida).
- `student_body_limitations` alimentada pela anamnese: dor "resolvida" continua no semáforo até nova
  anamnese/edição — futuro: botão "marcar como resolvida".

## 13. Status final

- Product Differentiation = **ACCEPT_WITH_NOTES**
- Student Experience = **IMPROVED** · Professor Experience = **IMPROVED**
- Cost Optimization = **IMPROVED** (documentado; estrutural já era barato)
- BN Prescription Engine = **PRESERVED** · Edge Behavior = **PRESERVED** (nenhuma edge alterada nesta sprint)
- Banco = **UNCHANGED** · Flag ON = **OFF** · Cutover = **NOT_DONE** · Deploy = ver commit final
