# Envio direto pelo WhatsApp da plataforma

Hoje a plataforma só permite **copiar link** nos formulários. Vamos adicionar botões de **envio direto pelo WhatsApp conectado** (Evolution API) em três lugares, reaproveitando a infraestrutura já existente (`whatsapp-manager` + `EVOLUTION_API_*`).

## 1. Backend — nova ação no `whatsapp-manager`

Criar a ação `send-text-to-number` na edge function `supabase/functions/whatsapp-manager/index.ts`:
- Recebe `{ phone, message }`.
- Valida o número com a função `validateBrazilMobile` já existente (rejeita número incompleto e retorna motivo claro).
- Envia via `POST {evoUrl}/message/sendText/{instanceName}` (mesmo padrão de `send-student-text`).
- Escopo por empresa e checagem de instância conectada, iguais às ações atuais.
- Retorna erro explícito quando o WhatsApp não está conectado ou o número é inválido.

A anamnese continuará usando a ação já existente `send-anamnesis-invite` (que gera o link individual `/anamnese/{studentId}`).

## 2. Questionários › Cadastro (`src/components/FormFieldEditor.tsx`)

Ao lado de **Copiar link**, adicionar botão **Enviar por WhatsApp** (só no `formType === "registration"`):
- Abre um diálogo com: campo de telefone (com máscara BR) e uma mensagem pré-preenchida contendo o link público de cadastro (`/inscricao/{slug}` ou `/cadastro/{slug}`, usando o slug da empresa como já é feito no `copyPublicLink`).
- Botão "Enviar" chama `whatsapp-manager` → `send-text-to-number`.
- Toasts de sucesso / erro (ex.: "Número incompleto", "WhatsApp não conectado").

## 3. Questionários › Anamnese (`src/components/FormFieldEditor.tsx`)

O link de anamnese é individual por aluno, então em vez de campo de telefone:
- Adicionar botão **Enviar anamnese por WhatsApp** (só no `formType === "anamnesis"`).
- Abre um diálogo com busca/seleção de aluno (lista de `students` da empresa, com nome e WhatsApp).
- Ao confirmar, chama `whatsapp-manager` → `send-anamnesis-invite` com o `studentId` selecionado e `baseUrl`.
- Mostra o mesmo feedback detalhado de falha por aluno já usado no `StudentsManager`.

## 4. Tela de Alunos (`src/pages/admin/StudentsManager.tsx`)

Transformar o botão **Link de Cadastro** em um menu com duas opções:
- **Copiar link** (comportamento atual).
- **Enviar por WhatsApp** → abre diálogo com campo de telefone + mensagem com o link de cadastro e envia via `send-text-to-number`.

O envio em lote de anamnese por WhatsApp (seleção de alunos) já existe e será mantido como está.

## Detalhes técnicos

- Reutilizar `validateBrazilMobile` no backend; não duplicar validação.
- Frontend usa `supabase.functions.invoke("whatsapp-manager", ...)` e lê o erro real com `FunctionsHttpError`/`error.context.text()` para exibir a causa (número inválido, WhatsApp desconectado).
- Máscara de telefone com `formatPhone`/`formatPhone` já disponível em `src/lib/masks.ts` (mesmo helper usado no cadastro de aluno).
- Sem mudanças de banco de dados. Nenhum segredo novo (usa `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` já configurados).
- Componentes de UI: `Dialog`, `Input`, `Textarea`, `Button`, `DropdownMenu` (shadcn, já no projeto).

## Resultado

Em Cadastro, Anamnese e na lista de Alunos você poderá enviar o link direto pelo WhatsApp da plataforma, sem sair para copiar/colar, com validação de número e mensagens de erro claras.
