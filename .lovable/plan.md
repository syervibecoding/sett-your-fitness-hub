

# Plano: Corrigir conexão QR Code WhatsApp

## Problema

O erro "Não é possível conectar novos dispositivos no momento" do WhatsApp ocorre porque a instância na Evolution API fica num estado "zombie" -- a instância existe mas está em estado `connecting` preso. Quando o app chama `init-connection`, ele detecta que a instância existe e chama `/instance/connect/` repetidamente, mas o WhatsApp bloqueia novas tentativas.

Conectar diretamente na Evolution funciona porque lá provavelmente se deleta/recria a instância primeiro.

Além disso, o polling de `check-status` a cada 5s está disparando ~12 requests/minuto para a Evolution API continuamente (visível nos network requests).

## Solução

### 1. Adicionar action "restart-connection" no edge function

Nova action no `whatsapp-manager/index.ts` que:
- Faz logout da instância: `DELETE /instance/logout/{instanceName}`
- Deleta a instância: `DELETE /instance/delete/{instanceName}`
- Recria do zero com `POST /instance/create` (mesmo fluxo do `init-connection`)
- Retorna o novo QR code

### 2. Melhorar o `init-connection` existente

Quando a instância existe mas o `/instance/connect/` retorna estado diferente de "open" e sem QR code:
- Fazer logout + delete + recreate automaticamente (em vez de ficar preso)

### 3. Adicionar botão "Reconectar" na UI

No `WhatsAppSettings.tsx`, quando o estado é `waiting_qr` e o QR não aparece (ou o usuário não consegue escanear):
- Mostrar botão "Reconectar" que chama `restart-connection`
- Isso deleta a instância e gera um QR code novo

### 4. Reduzir frequência de polling

Mudar o intervalo de polling de 5s para 8-10s quando está em `waiting_qr`, para não sobrecarregar a API Evolution.

## Arquivos alterados

- `supabase/functions/whatsapp-manager/index.ts` -- nova action `restart-connection`, melhoria no `init-connection`
- `src/pages/admin/WhatsAppSettings.tsx` -- botão "Reconectar", ajuste no polling

