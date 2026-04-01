

# Plano: Layout Horizontal com Abas no Detalhe do Aluno

## Estrutura

```text
┌──────────────────────────────────────────────────┐
│ ← Nome do Aluno    Status    [Ativar Acesso] [✏] │
│   email · whatsapp · treinador                    │
├──────────────────────────────────────────────────┤
│ Visão Geral │ Programa │ Análises │ Anamnese │    │
│             │          │          │ Financeiro│    │
│             │          │          │ Avaliações│    │
├─────────────┴──────────┴──────────┴───────────┤
│  (conteúdo da aba selecionada)                   │
└──────────────────────────────────────────────────┘
```

## Abas

1. **Visão Geral** — Grid 2 colunas: esquerda (matrícula ativa, ciclos, notas), direita (WeeklyBar + resumo rápido)
2. **Programa de Treino** — Matrículas + Calendário de Ciclos
3. **Análises** — TrainerWeeklyBar + WorkoutAnalysis completo (volume semanal, distribuição muscular, stats)
4. **Anamnese** — Card de anamnese
5. **Financeiro** — Pagamentos + Asaas
6. **Avaliações** — Fotos, áudios, notas

## Mudanças

### Header compacto (inline)
- Nome, status badge, email, whatsapp, treinador em uma linha
- Botões de ação no canto direito
- Remove card "DADOS PESSOAIS" separado

### Arquivo: `src/pages/admin/StudentDetail.tsx`
- Reorganizar JSX (~linhas 745-1240) usando `<Tabs>` do shadcn
- Mover `TrainerWeeklyBar` e `WorkoutAnalysis` para aba "Análises" dedicada
- Grid responsivo (`grid-cols-1 lg:grid-cols-2`) na Visão Geral
- Nenhuma mudança em queries, estados ou handlers

