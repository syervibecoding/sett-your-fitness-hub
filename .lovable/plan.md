## Onda 1 — Quick wins para visão do aluno (sem IA)

Quatro entregas independentes que reforçam o relacionamento aluno↔treinador e dão mais clareza ao aluno durante a execução do treino.

---

### 1. Feedback pós-treino do aluno → treinador

Hoje o `WorkoutSummary` só mostra estatísticas. Vamos transformá-lo num canal estruturado de feedback.

**O que muda para o aluno:**
- Ao concluir o treino, antes do resumo final, abre um passo de feedback com:
  - Escala de **dificuldade percebida** (1–10, slider)
  - Escala de **disposição/energia** (1–5, emojis)
  - **Body map** para marcar áreas de dor/desconforto (reaproveita `BodyMap`)
  - Campo de **observações livres** (opcional)
- Pode pular ("Enviar depois") ou enviar. Após envio, segue para o resumo normal.

**O que muda para o treinador:**
- Em `StudentDetail`, nova aba/seção **"Feedbacks"** com lista cronológica dos feedbacks recebidos (sessão, data, dificuldade, energia, áreas de dor, observações).
- Badge de "feedback novo" no card do aluno em `StudentsManager` quando houver feedback não lido.

**Técnico:**
- Nova tabela `workout_feedback` (student_id, company_id, workout_session_id, difficulty 1-10, energy 1-5, pain_areas jsonb [{muscle_group_id, intensity}], notes, read_at, created_at) com RLS company-scoped + student-owns-own.
- Componente novo `PostWorkoutFeedback.tsx` chamado no fim de `useWorkoutSession.finishWorkout` antes de mostrar summary.

---

### 2. "Semana X de Y" + orientações do dia no topo da sessão

Hoje a faixa do ciclo aparece só no `StudentHome`. Dentro do treino o aluno perde a noção de em que momento do ciclo está.

**O que muda:**
- No topo de `StudentWorkout` (acima dos exercícios), faixa fixa mostrando:
  - **Semana X de Y** do ciclo (calculado a partir de `training_cycles.start_date` + `cycle_duration_days`)
  - Dia do treino dentro da semana (ex: "Treino B — Costas e Bíceps")
  - **Orientações do dia**: bloco recolhível com as `notes` do workout específico (campo já existe no schema de workouts; só não estamos exibindo destacado).

**Técnico:**
- Componente novo `WorkoutHeader.tsx` consumindo dados já carregados em `useWorkoutSession`.
- Garantir que `notes` do workout venha no fetch e renderizar com `<Collapsible>` recolhido por padrão.

---

### 3. Meta semanal configurável + streak

Hoje o `WeeklyBar` mostra 7 dias mas sem meta nem streak.

**O que muda para o aluno:**
- No `StudentHome`, ao lado da barra semanal:
  - **Meta semanal** editável (3, 4, 5, 6 treinos/semana) — botão ⚙️ abre modal
  - Progresso "3/4 treinos esta semana"
  - **Streak** de semanas seguidas batendo a meta (🔥 X semanas)

**Técnico:**
- Adicionar coluna `weekly_workout_goal int default 3` em `students`.
- Função utilitária `calculateStreak(studentId)` que percorre semanas ISO retroativamente contando quantas atingiram a meta vigente. Calculada client-side a partir do histórico já carregado.
- Pequeno modal para editar a meta (atualiza `students.weekly_workout_goal`).

---

### 4. Aviso de renovação automático + form de feedback de ciclo

Hoje o admin vê alertas de renovação, mas o aluno não recebe nada até o treinador agir.

**O que muda:**
- Quando faltar **≤ 7 dias** para o fim do ciclo/plano, exibir banner persistente no topo do `StudentPortal`:
  - "Seu ciclo termina em X dias. Conte como foi para o seu treinador."
  - Botão "Dar feedback do ciclo" → abre formulário com:
    - Como você avalia este ciclo? (1–5 estrelas)
    - O que funcionou bem? (texto)
    - O que poderia melhorar? (texto)
    - Quer renovar? (sim / quero conversar / não vou continuar)
- Treinador vê feedback de ciclo em `StudentDetail` (mesma aba "Feedbacks", seção separada).
- Notificação no dashboard admin (`RenewalsAndCyclesPanel`) quando feedback de ciclo for recebido.

**Técnico:**
- Nova tabela `cycle_feedback` (student_id, company_id, enrollment_id, rating 1-5, what_worked, what_to_improve, renewal_intent enum, created_at) com RLS.
- Cálculo de "dias até o fim" feito client-side a partir de `enrollments.end_date` ou último `training_cycle.end_date`.
- Reusar lógica de "feedback não lido" do item 1 para badge no admin.

---

### Detalhes técnicos consolidados

**Migrations (Supabase):**
1. `workout_feedback` table + RLS
2. `cycle_feedback` table + RLS
3. `students.weekly_workout_goal` column

**Arquivos novos:**
- `src/components/student/PostWorkoutFeedback.tsx`
- `src/components/student/WorkoutHeader.tsx`
- `src/components/student/WeeklyGoalEditor.tsx`
- `src/components/student/CycleFeedbackBanner.tsx`
- `src/components/student/CycleFeedbackForm.tsx`
- `src/components/admin/StudentFeedbackTab.tsx`
- `src/lib/streakCalculator.ts`

**Arquivos alterados:**
- `src/hooks/useWorkoutSession.ts` (disparar feedback antes do summary)
- `src/pages/student/StudentWorkout.tsx` (render `WorkoutHeader`)
- `src/components/student/StudentHome.tsx` (meta + streak)
- `src/pages/student/StudentPortal.tsx` (banner de renovação)
- `src/pages/admin/StudentDetail.tsx` (aba Feedbacks)
- `src/components/student/WeeklyBar.tsx` (meta visual)

### Ordem de execução
1. Migrations (3 em uma só) → aprovar
2. Item 2 (header de semana/orientações) — menor risco, validação rápida
3. Item 1 (feedback pós-treino + aba no admin)
4. Item 3 (meta semanal + streak)
5. Item 4 (banner de renovação + feedback de ciclo)

Sem mudanças de IA, sem integrações externas, sem mexer em cobrança.
