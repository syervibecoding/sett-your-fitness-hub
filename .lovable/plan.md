# Correção: mensagens enviadas não aparecem no chat do WhatsApp

## Causa raiz

Em `src/pages/admin/WhatsAppChat.tsx` a assinatura realtime escuta INSERTs em `whatsapp_messages` filtrando por `company_id=eq.${effectiveCompanyId}`:

```ts
.on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages",
    filter: `company_id=eq.${effectiveCompanyId}` }, ...)
```

Mas a edge function `supabase/functions/whatsapp-manager/index.ts`, nas ações `send-message` (linha 324) e `send-media` (linha 415), insere a mensagem **sem `company_id`**. Como a coluna existe e fica `NULL`, o filtro do Realtime nunca casa, o evento não chega ao cliente, e a mensagem não aparece como enviada — apesar de já ter saído pela Evolution API e chegado no WhatsApp do destinatário.

Mesma situação no UPDATE de `whatsapp_chats`: ele não atualiza o `company_id` (já existente, ok), mas o chat só é atualizado via `loadChats()` que é disparado pelo mesmo handler.

## Correção

1. Em `supabase/functions/whatsapp-manager/index.ts`:
   - Em `send-message` (linha 324), incluir `company_id: companyId` no insert de `whatsapp_messages`.
   - Em `send-media` (linha 415), incluir `company_id: companyId` no insert de `whatsapp_messages`.
   - Garantir que `companyId` usado é o já validado/escopado da requisição (mesma variável já em uso na função).

2. Não há mudanças de schema nem de RLS necessárias (coluna já existe e é nullable).

3. Backfill opcional (não crítico): rodar um UPDATE para preencher `company_id` em mensagens antigas com `NULL` a partir do `chat_id` → `whatsapp_chats.company_id`. Isso só afeta histórico; o bug do "não aparece" é resolvido apenas com os inserts corrigidos.

## Validação

- Enviar mensagem pelo painel da BN → deve aparecer imediatamente na conversa sem refresh.
- Enviar mídia (imagem/áudio/documento) → idem.
- Conferir nos logs da edge `whatsapp-manager` que não há erro de insert.
- Confirmar via `select company_id from whatsapp_messages order by created_at desc limit 5` que novos registros têm `company_id` preenchido.

## Detalhes técnicos

- Arquivo: `supabase/functions/whatsapp-manager/index.ts` (apenas 2 inserts).
- Frontend não muda.
- Sem migração de banco.
