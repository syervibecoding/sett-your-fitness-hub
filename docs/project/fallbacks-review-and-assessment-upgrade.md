# Revisão dos 5 fallbacks + Upgrade da Avaliação Funcional

**Data:** 04/07/2026 · **Autor:** Claude (ATENA) · ordem autônoma
**Base científica (PubMed):** vídeo > tempo real (Rogers 2019, 10.1519/JSC.0000000000002175);
OHS observacional detecta valgo/MKD (Post 2016, 10.1123/jsr.2015-0178); fotogrametria confiável
para postura (Saad 2011, 10.1016/j.jbmt.2011.03.005; Nonnenmacher 2023, 10.1016/j.jbmt.2023.04.078);
vídeo 2D ≈ 3D no OHS (Soylu 2025, 10.3390/life15010080).

## Como está cada fallback (mapeado por workflow, 3 agentes)

| Fallback | Como funciona hoje | Qualidade |
|---|---|---|
| **Musculação** | `buildEmergencyFallbackPlan` (determinístico, flag off). 3 treinos fixos × 6 exercícios, seleção por keyword no catálogo (917 ex), risco (joelho/lombar/dor) adapta, readiness corta 20%, periodização 3 blocos, método do isolador varia por objetivo. | **Bom e seguro**, mas genérico: mesmos 3 treinos p/ todos os objetivos/níveis; seleção por keyword frágil; não usa `targets`/`substitutes`/`difficulty` do catálogo. |
| **Corrida/Natação/Pedal** | `cardioEngine.ts` determinístico: zonas de FC, progressão semanal, fueling; sport-neutral. | **Funciona**, mas pouca diferenciação real entre modalidades e volume inicial x anamnese. |
| **Avaliação funcional** | `buildDeterministicAssessmentJson`: **só cortava frames** → compensações `presente=false`, `findings=[]`, músculos vazios. | **Era o mais fraco** — entregável pobre. **Corrigido nesta rodada.** |

## O que implementei nesta rodada (foco: AVALIAÇÃO)

### 1. Avaliador determinístico de verdade (edge `ai-functional-assessment`)
Antes: fallback marcava tudo `presente=false` (não "via" nada). Agora:
- **Inferência do texto do professor:** `inferCompensationsFromText()` lê as observações técnicas +
  queixa + histórico e mapeia para as 7 compensações OHS/postura por aliases, com severidade.
- **Compensações enriquecidas** (as 7 já existentes ganharam): mapa muscular (encurtados/inibidos),
  plano corretivo (exercícios que existem na biblioteca), linguagem de aluno e `view` para agrupar.
- **Saída rica:** `vistas[]` (por vista, com descrição em linguagem de aluno), `plano_corretivo`
  (alongar/ativar dedup), `musculos_encurtados`/`musculos_fracos`, `prioridades_corretivas`
  estruturadas, `relatorio_para_aluno` educativo (por achado + plano + segurança) e
  `checklist_professor` (o que observar em cada vista) — transforma o fallback "cego" em ferramenta guiada.
- **Segurança preservada:** dor/EVA ≤3/10, red flags por keyword, protocolo MMII/MMSS/radiculopatia,
  handoff. `redFlag` marcado nos padrões que exigem revisão (valgo, butt wink, drop de pelve).

### 2. Base científica reutilizável (front)
`src/lib/assessment/functionalAssessmentCriteria.ts`: base determinística completa (OHS + postura →
músculos → corretivos → linguagem de aluno + score de movimento + citações), pronta para o app usar
no laudo e no checklist do professor.

### 3. PDF entregável para o aluno
`generateAssessmentPDF`: nova seção **"Seu plano corretivo"** (mobilizar/alongar × ativar/fortalecer,
em 2 colunas, com exercícios da biblioteca) além das vistas e do laudo educativo.

## Como a IA e o fallback se unificam
A IA de visão decide **pouco** (quais compensações estão presentes) e o motor determinístico
**explica muito** (músculos, corretivos, laudo) — mesmo pipeline, rule-traceable, custo baixo.
`confianca_visual` sai "media" quando inferido do relato, "baixa" quando não há texto.

## Backlog (não feito, documentado)
- **Musculação:** gerar # de exercícios/volume por objetivo+nível; usar `targets`/`substitutes` do
  catálogo na seleção (hoje keyword). Melhoria de qualidade, não de segurança.
- **Cardio:** diferenciar de verdade natação (metragem/técnica) x pedal (potência/zonas) x corrida.
- **Avaliação:** prompt da IA de visão retornar compensações por `key` (hoje o fallback já faz;
  alinhar o path de IA ao mesmo schema para 100% de simetria).
- **PDF:** seção de reavaliação (reteste em 6-8 semanas) e resumo de desequilíbrio muscular visual.

## Validação
`deno check` ai-functional-assessment ✅ · `tsc` 0 ✅ · build ✅ · testes (rodados) · motor **intocado**.
Deploy: edge `ai-functional-assessment` + frontend. Banco UNCHANGED. Flags OFF.
