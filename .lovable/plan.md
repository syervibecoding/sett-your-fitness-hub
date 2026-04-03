

# Plano: Alinhar WhatsApp Manager com projeto BN Performance (referência funcional)

## Diferenças encontradas

Comparei linha a linha os dois projetos. A edge function é quase idêntica, mas há diferenças sutis que podem causar o problema:

### 1. Falta de verificação `connectRes.ok` (linha 174)
No projeto atual, após `fetch(connect/${instanceName})`, o código faz `connectRes.json()` sem verificar se a resposta HTTP foi bem-sucedida. Se a Evolution retorna erro HTTP (ex: 404, 500), o `json()` pode falhar silenciosamente ou retornar dados inesperados.

### 2. Polling interval diferente
- BN Performance: `setInterval(checkStatus, 5000)` (5s)
- Projeto atual: `setInterval(checkStatus, 10000)` (10s)

O QR code da Evolution API expira rapidamente (~40s). Com polling a cada 10s, o front pode não detectar a conexão a tempo.

### 3. Front-end tem `handleRestart` que destrói e recria
O BN Performance não tem botão "Reconectar" — só "Cancelar". O `restart-connection` do projeto atual faz `destroyInstance()` + `createFreshInstance()`, o que pode gerar problemas se a instância não for limpa a tempo (delay de 1.5s pode não ser suficiente).

### 4. Sem logs na edge function
Não há `console.log` nos pontos críticos para diagnosticar onde exatamente falha.

## Solução

### Edge function `whatsapp-manager/index.ts`
1. Adicionar `console.log` com payloads da Evolution API nos pontos de `init-connection`, `connect`, e `check-status`
2. Verificar `connectRes.ok` antes de parsear JSON — se falhar, fazer fallback para `destroyInstance` + `createFreshInstance`
3. Aumentar delay do `restart-connection` de 1.5s para 3s para dar tempo à Evolution limpar

### Front-end `WhatsAppSettings.tsx`
4. Reduzir polling de 10s para 5s (igual ao BN Performance)
5. Mostrar detalhes do erro no toast quando `invoke()` falha (incluir `details` do servidor)

## Arquivos alterados
- `supabase/functions/whatsapp-manager/index.ts` — logs, verificação `connectRes.ok`, delay maior
- `src/pages/admin/WhatsAppSettings.tsx` — polling 5s, erros detalhados

