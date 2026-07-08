## Studio de Prescrição — alinhar ao fluxo integrado (5 etapas)

Objetivo: deixar o `/prescricao` (UnifiedPrescriber) igual ao fluxo das imagens e garantir que **tanto a Prescrição quanto o Studio Integrado publiquem no app do aluno**.

### Validação atual (o que o git diz)

- **Corrida/Natação/Ciclismo** já caem no app do aluno ao gerar (`ai-running-plan` → `running_plans`, lido pelo `CardioPlanView`).
- **Nutrição** também (motor `generateNutritionPlan` → `nutrition_plans` status `active`, lido pelo `NutritionPlanView`).
- **Musculação NÃO chega** hoje: a IA grava só em `ai_strength_plans` (rascunho), mas o aluno lê `training_cycles` + `workouts`. Falta o passo de publicar.
- **Vídeo**: cortes em frações desiguais e sem intervalo por segundos.
- **Edição de treino** e **botão publicar**: não existem no Studio Integrado.

---

### Etapa 1 — Avaliação por vídeo: cortes em segundos iguais
`src/components/VideoAssessment.tsx`
- Trocar os `fractions` fixos por cálculo de **intervalos iguais** a partir da duração: N cortes distribuídos uniformemente (pontos médios de N segmentos iguais). Mantém os rótulos de vista por protocolo.
- Mostrar o tempo (s) de cada corte. Revisão continua manual (marcar compensações), sem IA — conforme escolhido.

### Etapa 2 — Anamnese seleciona o que o aluno recebe + orquestração
`src/pages/admin/UnifiedPrescriber.tsx`
- Mover o seletor de modalidades da etapa 3 para a **etapa Anamnese**, em cards "O que esse aluno vai receber?" com 5 opções: **Musculação, Corrida, Natação, Ciclismo, Nutrição** (ícone + subtítulo, igual à imagem).
- Mapeamento (motores existentes): Musculação → `ai-prescribe-workout`; Corrida/Natação/Ciclismo → `ai-running-plan` (param `sport`); Nutrição → `generateNutritionPlan`.
- Card **"Orquestração"** com os blocos de 6 semanas (Semanas 1‑2 base técnica → 3‑4 acumulação/progressão → 5‑6 consolidação/refino), derivado da anamnese.

### Etapa 3 — Prescrição integrada + PDFs
- "Gerar N prescrições integradas" passa a iterar sobre **todas** as modalidades marcadas (não só 2).
- Lista "Prescrições geradas" com status *pronta* por modalidade + cards de **Periodização 6 semanas** para musculação (SEM 1…6, RIR, %vol).
- "Baixar PDFs separados (N)" reaproveitando os helpers de PDF já existentes por modalidade.

### Etapa 4 — Editar treino (fallback)
- Após gerar musculação, seção expansível "Revisar e editar o treino" → **Treino A/B/C** com campos editáveis de Série / Reps / Descanso / Obs, adicionar/remover exercício e remover treino (estado local derivado do plano da IA).

### Etapa 5 — Publicar no app do aluno
- Seletor de **ciclo de treino** do aluno (busca ciclos via `enrollments` → `training_cycles`; escolher/atualizar ciclo, conforme escolhido).
- Botão **"Publicar treino no app do aluno"**: grava os treinos (já editados) em `workouts` do ciclo escolhido — reaproveitando a mesma lógica do `PrescriptionStudio.handleApply` (limpa e reinsere workouts do ciclo).
- Corrida/natação/ciclismo/nutrição já ficam visíveis ao gerar; a publicação explícita cobre a musculação.

---

### Detalhes técnicos
- Arquivos: `UnifiedPrescriber.tsx` (reestruturação maior), `VideoAssessment.tsx` (intervalos iguais). Sem novos edge functions, sem mudança de schema.
- Publicação reusa padrão existente: `delete workouts where cycle_id` + `insert` dos treinos (com `company_id`, `created_by`).
- Ambos os caminhos (PrescriptionStudio determinístico + UnifiedPrescriber IA) passam a publicar em `training_cycles/workouts` → app do aluno.
- Fora de escopo: novos motores de IA, novas tabelas, mudança na visibilidade do portal do aluno.