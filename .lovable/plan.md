# Remover feedback do app e direcionar para o WhatsApp

Substituir todos os formulários/coletas de feedback (pós-treino, ciclo e histórico no admin) por um link direto para o WhatsApp fixo `https://wa.me/message/GZWXMSEEKWGII1`.

## O que muda

### 1. Feedback pós-treino (aluno)
- Remover o formulário `PostWorkoutFeedback` (dificuldade, energia, áreas de dor, notas) que aparece antes do resumo do treino.
- Depois de concluir o treino, o aluno vai direto para o resumo (`WorkoutSummary`).
- No resumo, o botão "Enviar Feedback" passa a abrir o link fixo do WhatsApp (em vez de montar uma mensagem com a instância da empresa). O botão fica sempre visível, sem depender do número da empresa.

### 2. Feedback de ciclo (aluno)
- No banner "Seu ciclo termina em X dias", o botão "Dar feedback do ciclo" deixa de abrir o formulário com estrelas/intenção de renovação e passa a abrir o link fixo do WhatsApp.
- O formulário `CycleFeedbackForm` deixa de ser usado.

### 3. Histórico de feedback (admin / treinador)
- Remover a aba "Feedbacks" da ficha do aluno (`StudentDetail`), junto com o componente `StudentFeedbackTab` que listava feedbacks de ciclo e pós-treino.

### Componentes removidos
- `src/components/student/PostWorkoutFeedback.tsx`
- `src/components/student/CycleFeedbackForm.tsx`
- `src/components/admin/StudentFeedbackTab.tsx`

## Detalhes técnicos

- Criar uma constante `WHATSAPP_FEEDBACK_URL = "https://wa.me/message/GZWXMSEEKWGII1"` usada nos pontos abaixo.
- `StudentPortal.tsx`: remover import e uso de `PostWorkoutFeedback`, o estado `pendingFeedbackSessionId` e a lógica que "trava" o resumo até o feedback. O `WorkoutSummary` passa a renderizar assim que `session.summary` existir.
- `WorkoutSummary.tsx`: trocar o `onClick` do botão "Enviar Feedback" por `window.open(WHATSAPP_FEEDBACK_URL, "_blank")` e exibi-lo sempre (remover a dependência de `whatsappNumber`). O botão "Compartilhar" continua igual.
- `CycleFeedbackBanner.tsx`: remover import/uso de `CycleFeedbackForm`; o botão vira um link/abertura do `WHATSAPP_FEEDBACK_URL`. O banner ainda aparece nos últimos 7 dias do ciclo; pode-se manter o controle de "dispensar".
- `StudentDetail.tsx`: remover o `TabsTrigger value="feedback"`, o `TabsContent value="feedback"` e o `lazy import` de `StudentFeedbackTab`.

## Banco de dados
- As tabelas `workout_feedback` e `cycle_feedback` deixam de ser usadas pela aplicação. Por padrão **não vou apagá-las** (para preservar dados já coletados). Posso remover via migração se você confirmar — me avise.

## Observação
- O link `wa.me/message/...` é um deep link genérico (não aceita texto pré-preenchido), então o aluno cai direto na conversa, sem mensagem automática. Os botões de "Compartilhar" resumo continuam funcionando normalmente.
