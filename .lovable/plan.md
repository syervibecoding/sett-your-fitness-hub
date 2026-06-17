# Plano: Boneco anatômico + UX da área do aluno

Baseado na auditoria do repositório BN, adaptado para o Set App (multi-profissional). Dividido em fases por impacto/esforço — dá pra parar em qualquer fase.

## Diagnóstico (o que temos vs. o que o BN tem)

| Recurso | Set App hoje | BN | Ação |
|---|---|---|---|
| Boneco | SVG paramétrico só de largura (`BodyAvatar.tsx`) | Mapa anatômico `react-muscle-highlighter` (frente/costas, músculos) | **Trocar/expandir** |
| Mapa muscular | Radar/spider de volume (`MuscleRadar.tsx`) | Heatmap no corpo por grupo | **Adicionar heatmap** |
| Tela acesa no treino | ❌ | `useWakeLock` | **Portar** |
| Som no fim do descanso | só vibra (`RestTimer`) | beep Web Audio + mute persistido | **Portar** |
| Celebração de PR | toast simples | beep + vibração + toast | **Enriquecer** |

## Fase 1 — Boneco anatômico com heatmap de volume (maior impacto visual)

Adotar `react-muscle-highlighter` (compatível com React 18) e criar uma camada de contrato própria, multi-tenant.

1. `bun add react-muscle-highlighter`.
2. Novo `src/lib/bodyMap.ts`: contrato único com as regiões anatômicas (`chest`, `shoulders`, `biceps`, `triceps`, `forearm`, `abs`, `trapezius`, `back`, `lower_back`, `glutes`, `quads`, `hamstrings`, `adductors`, `calves`) + mapeamento `REGION_TO_SLUG` e helper `muscleGroupToRegion` (liga os grupos cadastrados por cada empresa às regiões do boneco — sem hardcode da BN).
3. Novo `src/components/body/BodyMap.tsx`: wrapper genérico com toggle Frente/Costas, gênero, `getRegionFill(region)`, `onRegionClick`. Cores via tokens do design system (não hardcode).
4. Novo `src/components/student/MuscleHeatmap.tsx`: recebe os volumes que já alimentam o `MuscleRadar` e pinta o corpo com intensidade proporcional ao volume (heatmap). Mantém a lista de barras kg embaixo.
5. Em Estatísticas do aluno: heatmap + radar lado a lado (radar continua útil pra comparar formato).

## Fase 2 — Boneco de medidas mantido e integrado

O boneco paramétrico atual (`BodyAvatar`) tem valor próprio (ajusta com circunferências em tempo real). Mantê-lo na aba **Medidas**, e usar o novo mapa anatômico (Fase 1) na aba **Estatísticas**. Sem retrabalho destrutivo.

## Fase 3 — UX de execução do treino (rápido, alto valor)

1. `src/hooks/useWakeLock.ts`: mantém a tela acesa enquanto a sessão está ativa (re-adquire no `visibilitychange`). Ativar no `StudentPortal` quando `session` ativo.
2. `src/lib/feedback.ts`: Web Audio API (zero assets) — `restDoneFeedback()` (beep+vibração no fim do descanso) e `prFeedback()` (beep mais agudo no PR). Mute persistido em `localStorage`.
3. `RestTimer.tsx`: tocar `restDoneFeedback()` no `onComplete` + botão mute (ícone Volume2/VolumeX).
4. PR: ao detectar recorde no fluxo de finalização, disparar `prFeedback()` junto do toast já existente.

## Fase 4 (opcional) — Mapa de limitações para o treinador

Reaproveitar o `BodyMap` para o treinador marcar limitações por região (muscular/articular/neural + severidade) no perfil do aluno. Requer tabela nova `student_body_limitations` (company-scoped, RLS). Só se houver interesse — é o item de maior esforço.

## Detalhes técnicos

- **Multi-tenant**: o boneco nunca assume grupos fixos. `muscleGroupToRegion` casa os nomes de grupamento cadastrados por cada empresa (normalizando acento/caixa) com as regiões do SVG; grupos sem correspondência aparecem só no radar/lista.
- **Design system**: highlights e estados usam tokens HSL de `index.css` (primary/muted/etc.), garantindo tema claro/escuro. Nada de `text-white`/`bg-[#...]`.
- **Sem mudança de schema** nas fases 1–3 (usam dados já existentes: `workout_logs`, volumes agregados, `students.gender`).
- **Fase 4** é a única que toca o banco.

## Ordem sugerida
Fase 3 primeiro (1 commit, rápido, sentido imediato no treino) → Fase 1 (boneco anatômico + heatmap) → Fase 2 (integração) → Fase 4 só se quiser.
