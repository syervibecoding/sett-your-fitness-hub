# Correção dos dois bugs

## Bug 1 — Aluno aparece "sem treinador" / "sem treino" no dashboard, mas no perfil tem

### Causa
- O card **AÇÕES PENDENTES** (tabela `admin_alerts`) cria um alerta **"Montar treino"** quando um treinador é atribuído, mas **esse alerta nunca é baixado** quando o treino é de fato montado — não existe nenhum lugar no código nem no banco que o resolva. Resultado: o aluno fica eternamente listado como pendente.
- O alerta **"Atribuir treinador"** só é resolvido quando o treinador é gravado na *matrícula* (`enrollments.trainer_id`). Mas o perfil do aluno também considera o treinador gravado direto no aluno (`students.assigned_trainer_id`). Quando o treinador está só num dos dois campos, o dashboard e o perfil divergem.
- A lista calculada **"AGUARDANDO TREINADOR"** olha apenas `students.assigned_trainer_id IS NULL`, ignorando o treinador da matrícula.

### Correção
1. **Migração no banco:**
   - Criar um gatilho em `workouts` (após inserir) que **resolve automaticamente** os alertas `build_workout` ("Montar treino") da matrícula correspondente.
   - Criar um gatilho em `students` (ao alterar `assigned_trainer_id`) que **resolve** os alertas `assign_trainer` em aberto desse aluno.
   - **Backfill** (limpeza dos dados já existentes): marcar como resolvidos os alertas `build_workout` cujos ciclos já têm treino, e os `assign_trainer` de alunos que já têm treinador (na matrícula ou no aluno).
2. **`src/components/DashboardAlerts.tsx`:** ajustar a lista "AGUARDANDO TREINADOR" para considerar o aluno *com treinador* quando ele tem treinador na matrícula **ou** no campo do aluno, evitando o falso "Sem treinador".

## Bug 2 — Erro ao clicar em "Feito" no perfil/treino do aluno

### Causa
O botão **"Feito"** (perfil do aluno → ciclo sem treino) insere um treino vazio em `workouts` para marcar o ciclo como prescrito, mas:
- **não envia o `company_id`** do aluno na inserção;
- **não é idempotente** — se o ciclo já tiver treino (programa já atribuído), a ação ainda é disparada e pode falhar/duplicar, exatamente o cenário que você descreveu ("não estavam precisando fazer isso").

### Correção (`src/pages/admin/StudentDetail.tsx`)
- Incluir `company_id: student.company_id` na inserção do treino.
- Antes de inserir, **reverificar se o ciclo já tem treino**; se já tiver, apenas recarregar os dados (sem inserir, sem erro).
- Manter/melhorar a mensagem de erro (toast) para casos legítimos de falha.

## Verificação
- Recarregar o dashboard e confirmar que alunos com treinador/treino somem dos cards de pendência.
- No perfil de um aluno com ciclo já prescrito, confirmar que "Feito" não gera erro.
- Conferir o build e o console sem erros.

## Detalhes técnicos
- Tabelas envolvidas: `admin_alerts`, `workouts`, `students`, `enrollments`, `training_cycles`.
- Os gatilhos usam `SECURITY DEFINER` e `search_path = public`, seguindo o padrão dos gatilhos já existentes no projeto.
- Nenhuma alteração em RLS é necessária; apenas resolução automática de alertas e ajuste de leitura no frontend.
