# Convite de anamnese via WhatsApp + aba "Formulário"

## Objetivo
Permitir enviar o link de anamnese do aluno direto pelo WhatsApp já integrado (Evolution API), tanto na ficha individual quanto em lote. Sem tabela nova de rastreamento e mantendo o link atual por ID (`/anamnese/{studentId}`). Também unir as páginas "Cadastro" e "Anamnese" numa única aba "Formulário" com sub-abas.

O envio de resposta ao banco já funciona hoje (edge `public-anamnesis`, ação `submit`) — nada muda nisso.

## Parte 1 — Envio pelo WhatsApp

### Backend (edge `whatsapp-manager`)
Adicionar uma nova ação `send-anamnesis-invite` que reaproveita toda a infra já existente (autenticação por papel, resolução de company/instância, envio via `message/sendText`).

- Entrada: `{ studentIds: string[], baseUrl: string, message?: string }`.
- Para cada `studentId`: busca `full_name`, `whatsapp`, `company_id`; valida que pertence à empresa do usuário; se sem WhatsApp, marca como falha.
- Monta o link `${baseUrl}/anamnese/${studentId}` e um texto padrão (editável):
  > Olá {nome}! Para começarmos, preencha sua anamnese neste link: {link}
- Envia via Evolution para cada número.
- Retorna resumo `{ sent: number, failed: [{ id, name, reason }] }`.
- Restrições de papel: liberada para admin/coordinator/trainer (mesmo `canChat` já usado), não entra em `adminOnlyActions`.

### Frontend
- **`StudentDetail.tsx`**: ao lado do botão "Anamnese" (copiar link), adicionar botão "Enviar no WhatsApp" que chama a ação com `[id]` e `baseUrl = window.location.origin`. Desabilitado se o aluno não tiver WhatsApp. Toast de sucesso/erro.
- **`StudentsManager.tsx`**: adicionar seleção por checkbox nos cards da lista + botão de ação em lote "Enviar anamnese (WhatsApp)" para os selecionados; mostra toast com quantos foram enviados e quantos falharam (ex.: sem WhatsApp).

## Parte 2 — Aba única "Formulário"

Hoje existem dois itens de menu e duas rotas por papel: "Cadastro" (`RegistrationManager`) e "Anamnese" (`AnamnesisManager`), cada um só renderiza um `FormFieldEditor`.

- Criar `src/pages/admin/FormsManager.tsx` com um componente `Tabs` (shadcn) contendo duas sub-abas:
  - **Cadastro** → `FormFieldEditor formType="registration"` (conteúdo atual do RegistrationManager)
  - **Anamnese** → `FormFieldEditor formType="anamnesis"` (conteúdo atual do AnamnesisManager)
- **Rotas (`App.tsx`)**: adicionar `/admin/forms`, `/coordinator/forms`, `/trainer/forms` apontando para `FormsManager`, mantendo os `FeatureRoute`/módulos apropriados. As rotas antigas `/registration` e `/anamnesis` passam a redirecionar para `/forms` (evita links quebrados).
- **Sidebar (`AppSidebar.tsx`)**: substituir os dois itens ("Cadastro" e "Anamnese") por um único "Formulário" (ícone `FileText`) nos três blocos de papel; atualizar o mapa `routeToTitle` (linhas 62-63).
- `RegistrationManager.tsx` e `AnamnesisManager.tsx` podem ser removidos (ou mantidos e reaproveitados dentro do FormsManager). O plano é migrar o conteúdo para `FormsManager` e remover os dois arquivos antigos.

## Detalhes técnicos
- Nenhuma migração de banco necessária (sem `anamnesis_invites`).
- O envio usa `supabase.functions.invoke("whatsapp-manager", { body: { action: "send-anamnesis-invite", ... } })`.
- Empresa exige uma instância de WhatsApp conectada; se não houver, a edge retorna erro e o frontend mostra toast orientando conectar o WhatsApp.
- Verificação: testar a edge com `curl_edge_functions` (ação nova) e validar a UI (botão individual + lote + aba Formulário) via preview.

## Fora de escopo
- Tabela de rastreamento de convites (status enviado/aberto/respondido).
- Link com token único/expiração.
