# Otimização de Custo Operacional — SETT/BN

**Data:** 04/07/2026 · **Autor:** Claude (ATENA) · Sprint de evolução autônoma

## 1. Arquitetura de custo atual (o maior corte JÁ foi feito)

A decisão estrutural mais importante já está em produção: **prescrição fallback-first**.

| Fonte de custo | Estado | Custo por uso |
|---|---|---|
| Prescrição de força | `PRESCRIPTION_AI_FIRST=off` → motor **determinístico** gera tudo | **~R$ 0** (zero tokens) |
| Cardio (corrida/natação/bike) | `cardioEngine.ts` determinístico | **~R$ 0** |
| Nutrição | `nutritionEngine.ts` determinístico | **~R$ 0** |
| Refino de texto por IA | `company_ai_config.ai_text_refinement_enabled` **default false** (opt-in) | R$ 0 enquanto off |
| BNITO aluno — missão proativa | 1 chamada Haiku por rota/dia, **cacheada em sessionStorage** (`student-bnito-mission:<dia>:<rota>`) | centavos/aluno/dia |
| BNITO aluno — chat | on-demand (aluno pergunta) | centavos/pergunta |
| Avaliação funcional por vídeo | IA por frame, acionada MANUALMENTE pelo professor | maior custo unitário; uso esporádico |
| Shadow mode do motor | roda o engine determinístico em paralelo | ~R$ 0 (sem IA) |
| Coorte/recomendações (NPS, próximo ciclo) | RPCs SQL no Postgres | R$ 0 de IA |

**Conclusão:** o custo variável de IA por aluno/mês tende a centavos. O produto "decide pouco com IA
e explica muito com regra" — que é exatamente o posicionamento barato-e-explicável.

## 2. Guards já presentes (verificados)

- Duplo clique em gerar/publicar: botões usam estados `generating`/`publishing` (disabled durante).
- XP anti-duplicação no fim de sessão (guard no `finishSession`).
- Dashboard usa react-query (cache/dedupe de fetch) no `AdminDashboard`.
- PDFs são gerados client-side (jsPDF) → custo zero de servidor.
- Missão BNITO cacheada por dia+rota (evita re-chamada a cada render).

## 3. Otimizações desta sprint

- **Central de Atenção**: mensagens de retenção/renovação/dor são **templates locais** (zero IA) —
  o professor copia e cola; nada de gerar mensagem com LLM por aluno.
- **Card "Por quê + Segurança" do aluno**: explicação da fase e semáforo de dor são **derivados por
  regra local** (datas do ciclo + objetivo) — zero chamada de IA para "explicar o treino".
- Catálogo paginado nas edges auxiliares (fix `limit(700)`) evita re-tentativas/erros silenciosos.

## 4. Backlog de otimização (não implementado nesta rodada)

1. **Code-splitting** de `VideoAssessment` (404 kB) e `recharts` (504 kB) via `manualChunks` —
   reduz banda/tempo de load (Netlify cobra banda em excedente).
2. **Batch de frames** na avaliação funcional (1 chamada com N frames vs N chamadas) — maior
   redutor de custo unitário restante.
3. Painel "uso de IA" no admin (contador de chamadas/mês por empresa) — requer tabela nova
   (migration; gate).
4. TTL curto de cache nos cards do dashboard que não usam react-query (Cohort/MonthlyPrescriptions).

## 5. Riscos

- Se alguém ligar `PRESCRIPTION_AI_FIRST=on` ou o refino por IA sem revisar preços, o custo por
  prescrição sobe ordens de magnitude — manter off por default (está).
- Avaliação por vídeo é o único fluxo de custo relevante; monitorar volume de uso.
