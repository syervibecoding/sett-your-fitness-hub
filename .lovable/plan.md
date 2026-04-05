

# Plano: Botão de Feedback via WhatsApp no Summary do Treino

## Resumo
Adicionar um botão "Enviar Feedback" no dialog de resumo do treino que abre o WhatsApp da empresa com uma mensagem pré-preenchida com o resumo do treino.

## Como funciona
1. Ao carregar o portal do aluno, buscar o `phone_number` da `whatsapp_instances` da empresa do aluno
2. Passar esse número como prop para o `WorkoutSummary`
3. Renderizar um botão verde "Enviar Feedback" que abre `https://wa.me/{number}?text={resumo}` com o resumo do treino pré-preenchido
4. Se a empresa não tiver instância WhatsApp configurada, o botão não aparece

## Arquivos alterados

### `src/pages/student/StudentPortal.tsx`
- Na função `loadProfile`, após obter `companyId`, buscar `whatsapp_instances` para pegar o `phone_number`
- Guardar em estado `companyWhatsapp`
- Passar para `WorkoutSummary` como prop `whatsappNumber`

### `src/components/student/WorkoutSummary.tsx`
- Adicionar prop opcional `whatsappNumber?: string`
- Adicionar botão "Enviar Feedback" (verde, ícone WhatsApp) entre "Compartilhar" e "Fechar"
- Ao clicar, monta a URL `https://wa.me/{number}?text={resumo}` e abre em nova aba
- Botão só aparece se `whatsappNumber` estiver definido

