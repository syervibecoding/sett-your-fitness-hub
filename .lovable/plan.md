

# Plano: Prescrição inline na aba Treinos

## O que muda

Substituir o conteúdo atual da aba "Treinos" no `StudentDetail.tsx` pelo mesmo layout usado na tela de Prescrição (`WorkoutPrescriptions.tsx`) quando um aluno é selecionado:

- Cards por ciclo com header (CICLO N + badge Ativo/Concluído/Futuro + datas)
- Lista de treinos com check icon, nome e contagem de exercícios
- Botão "Editar Treinos" (se já tem treinos) ou "Prescrever Treino" (se vazio)
- Botão navega para `/admin/workout/{cycleId}` (WorkoutBuilder)
- Manter o BodyMap abaixo da lista de exercícios em cada treino (diferencial que já existe)

## Arquivo: `src/pages/admin/StudentDetail.tsx`

### Mudanças na aba "Treinos" (linhas ~1106-1165)

1. Buscar todos os ciclos da matrícula ativa (não filtrar apenas `has_workout`)
2. Renderizar cards por ciclo no formato da WorkoutPrescriptions:
   - Header: "CICLO {n}" em Bebas Neue + Badge de status + datas dd/MM
   - Se tem workouts: listar com CheckCircle2 + nome + badge "N ex."
   - Se não tem: mostrar Clock + "Nenhum treino prescrito"
   - Botão Editar/Prescrever que navega para `{prefix}/workout/{cycle.id}`
3. Remover o botão "Abrir Prescrição" com ExternalLink (não navega mais para outra página)
4. Manter BodyMap por treino expandível ou inline abaixo de cada workout card

### Sem mudanças em queries ou estados
- Usa `cycles` e `allWorkouts` já carregados

