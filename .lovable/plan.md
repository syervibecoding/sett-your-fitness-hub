

# Performance mensal real dos treinadores + filtro de meses

## O que é hoje
A aba **Performance** mostra "Prescrições por mês" — quantos treinos cada treinador *criou* nos últimos 3 meses fixos. Isso não reflete pagamento, porque o que importa é quantos treinos foram **executados pelos alunos** dele.

## O que você quer
1. Mostrar **treinos concluídos** pelos alunos atribuídos a cada treinador, por mês
2. Permitir **filtrar/escolher os meses** exibidos (não ficar preso aos 3 últimos)
3. Permitir registro de treinos feitos **fora do app** (treinos avulsos/manuais), para fins de pagamento

## Solução

### 1. Trocar fonte de dados de "prescrições" para "execuções"
Em `TeamManager.tsx → loadPerformance`:
- Substituir a query de `workouts` (prescrições) por `workout_sessions` com `status = 'completed'`
- Filtrar por `student_id` dos alunos atribuídos ao treinador (`assigned_trainer_id`)
- Agrupar por mês usando `completed_at`
- Renomear o card de "Prescrições por mês" → "Treinos concluídos por mês"

### 2. Filtro de período
Adicionar acima do grid:
- Seletor de **Mês inicial** e **Mês final** (ex: Jan/26 até Abr/26)
- Padrão: últimos 3 meses
- Ao mudar, recarrega a performance e ajusta as colunas dos cards dinamicamente
- Mostrar também **Total no período** ao lado do nome do treinador

### 3. Registrar treino feito fora do app (opcional, p/ pagamento)
Adicionar botão **"+ Registrar treino avulso"** em cada card de treinador, que abre dialog com:
- Aluno (dropdown — apenas alunos atribuídos àquele treinador)
- Data do treino
- Observação (opcional)

Insere em `workout_sessions` com `status = 'completed'`, `completed_at = data escolhida`, sem `workout_id` específico (usa um workout placeholder ou tornamos `workout_id` opcional).

> ⚠️ Hoje `workout_id` é **obrigatório** em `workout_sessions`. Para suportar treinos avulsos sem prescrição, precisamos tornar `workout_id` nullable via migration. Confirme se quer essa mudança ou se prefere criar um "workout placeholder" automático por aluno.

### Arquivos
- **Modificado**: `src/pages/admin/TeamManager.tsx` — trocar query, adicionar filtro de período, dialog de registro avulso
- **Migration** (se aprovado): tornar `workout_sessions.workout_id` nullable

### Observação importante
Os números atualmente zerados na sua tela são reais — ninguém ainda concluiu treinos no app. Após a mudança, continuarão zerados até alunos finalizarem treinos pelo portal **ou** até você registrar treinos avulsos manualmente.

