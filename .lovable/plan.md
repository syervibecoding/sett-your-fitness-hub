# Corrigir alertas falsos de "Sem data" e "Sem treino"

## Problema

Os cards do painel **DEFINIR DATA DE TREINO** e **SEM TREINO NO CICLO** estão mostrando alunos que, na prática, já estão com a situação resolvida. A causa é dupla:

1. **Matrículas duplicadas/antigas.** Vários alunos têm mais de uma matrícula. Quando uma matrícula antiga ficou "active" sem data de treino e sem ciclos (resquício de cadastro), ela continua sendo contada nos alertas mesmo que o aluno tenha uma matrícula nova completa. Ex.: Bruno Farias tem 3 matrículas — uma antiga vazia e duas novas com data e 8 ciclos.

2. **Lógica por matrícula, não por aluno.** O alerta avalia cada matrícula isoladamente. Basta uma matrícula sem data (ou um ciclo novo vazio) para o aluno aparecer, ignorando que ele já tem outra matrícula com data/treino definidos.

Resultado: o alerta vira ruído e o treinador não distingue quem realmente precisa de ação (ex.: Alexia, que nunca teve treino) de quem já está em dia.

## Objetivo

Os alertas devem refletir a situação real do aluno:

- **Definir data de treino**: só listar aluno cuja matrícula vigente realmente não tem data, e que não possua nenhuma outra matrícula com data já definida.
- **Sem treino no ciclo**: só listar aluno que não tem nenhum treino em nenhum ciclo da matrícula vigente (caso da Alexia). Aluno que já treina há ciclos e só está com o ciclo novo vazio não deve ser tratado como "aluno sem treino".

## Mudanças

### 1. Ajustar a lógica dos alertas (`src/components/DashboardAlerts.tsx`)

- **Escolher a matrícula vigente por aluno:** ao montar os alertas, agrupar matrículas por `student_id` e considerar apenas a matrícula mais relevante (a mais recente entre `active`/`awaiting_training`, dando preferência à que já tem ciclos). Matrículas antigas/duplicadas vazias deixam de gerar alerta.
- **Alerta "Definir data de treino":** flag somente quando a matrícula vigente do aluno está sem `training_start_date` **e** o aluno não tem nenhuma outra matrícula com `training_start_date` preenchida.
- **Alerta "Sem treino no ciclo":** flag somente quando o aluno não possui treino em **nenhum** ciclo da matrícula vigente (aluno verdadeiramente novo). Continua deduplicado por aluno (um item por aluno).

### 2. Limpeza de dados (matrículas duplicadas/antigas)

Corrigir os registros que já estão inconsistentes, sem apagar histórico válido:

- **Matrículas duplicadas idênticas** (mesmo aluno, mesma data de início e mesma data de treino, criadas quase no mesmo momento): manter a mais recente e marcar a duplicada como `inactive`.
- **Matrículas "active" vazias e antigas** (sem data de treino e sem ciclos) quando o aluno já tem outra matrícula completa: marcar como `inactive`.

Essa limpeza será feita com revisão caso a caso via atualização de dados (ferramenta de dados), não como migração de schema.

### 3. Validação

- Recarregar o painel do treinador/admin e confirmar que Bruno Farias sai do card "Definir data de treino".
- Confirmar que apenas alunos realmente sem data aparecem nesse card.
- Confirmar que apenas alunos sem nenhum treino (ex.: Alexia) aparecem em "Sem treino no ciclo".

## Detalhes técnicos

- A seleção da matrícula vigente por aluno será calculada em memória dentro de `fetchAlerts`, ordenando por `created_at` desc e priorizando matrículas com ciclos, evitando novas queries pesadas.
- Para "Sem treino", a checagem passa a olhar todos os ciclos da matrícula vigente (não só o ativo) para decidir se o aluno tem qualquer treino prescrito.
- A limpeza de dados afeta apenas a coluna `status` de `enrollments` (para `inactive`); nenhum ciclo, treino ou pagamento é removido.

## Fora de escopo (a confirmar depois, se desejar)

- Clonar automaticamente o treino do ciclo anterior para o ciclo novo (para o aluno nunca ficar com ciclo vazio). Não está incluído aqui; este plano apenas remove o ruído dos alertas. Posso adicionar em seguida se você quiser.
