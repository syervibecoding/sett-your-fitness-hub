## Objetivo

Adicionar dois envios manuais (por botão, nada automático) no dashboard:
1. **Cobrança/lembrete de renovação** por WhatsApp no card **RENOVAÇÃO**.
2. **Parabéns de aniversário** por **WhatsApp + e-mail** no card **ANIVERSÁRIOS**, disparado por botão.

Nenhum envio será agendado/automático — sempre por clique, com uma prévia editável da mensagem antes de enviar.

## 1. Lembrete de renovação (WhatsApp) — card RENOVAÇÃO

Arquivo: `src/components/dashboard/RenewalsAndCyclesPanel.tsx`

- Incluir `phone` nas queries de alunos (`students(full_name, status, phone)`) das listas "Aguardando renovação" e "Contratos vencendo".
- Em cada linha, adicionar um botão discreto **"Lembrar renovação"** (ícone WhatsApp), sem quebrar a navegação existente ao clicar no cartão (usar `stopPropagation`).
- Ao clicar, abrir um diálogo com a mensagem pré-preenchida e editável, ex.:
  `"Olá {nome}! Seu plano {plano} está próximo do vencimento. Vamos renovar? Qualquer dúvida, estou à disposição. 💪"`
- Enviar via `supabase.functions.invoke("whatsapp-manager", { action: "send-text-to-number", phone, message })` (ação já existente e implantada).
- Feedback com `toast` de sucesso/erro; se o aluno não tiver telefone válido, avisar.

## 2. Parabéns de aniversário (WhatsApp + e-mail) — card ANIVERSÁRIOS

Arquivo: `src/components/DashboardAlerts.tsx`

- Adicionar `phone` e `email` à query de aniversariantes (hoje só traz `id, full_name, birth_date, ...`).
- Em cada aniversariante, botão **"Enviar parabéns"** que abre diálogo com mensagem editável, ex.:
  `"Feliz aniversário, {nome}! 🎉 Toda a equipe deseja um dia incrível. Conte com a gente nos seus próximos objetivos!"`
- Ao confirmar, disparar **os dois canais**:
  - WhatsApp: `whatsapp-manager` → `send-text-to-number` (se houver telefone).
  - E-mail: nova edge function `send-email` (se houver e-mail).
- `toast` informando quais canais foram enviados (ex.: "Enviado por WhatsApp e e-mail").

## 3. E-mail via Resend (necessário para o canal de e-mail)

Hoje **não há Resend conectado**, então o canal de e-mail depende de uma configuração única:
- Conectar o **Resend** (connector) e verificar um domínio remetente.
- Criar edge function `supabase/functions/send-email/index.ts` que envia via gateway do Resend (`from` do domínio verificado, `to`, `subject`, `html`).
- Enquanto o Resend não estiver conectado, o botão de aniversário **continua funcionando pelo WhatsApp**; o e-mail é ignorado com aviso claro ("e-mail não configurado"), sem travar o envio.

## Observações técnicas

- Reutiliza a Evolution API já configurada (`send-text-to-number`) — sem mudanças no backend de WhatsApp.
- Sem novas tabelas nem migrações; apenas ajuste de `select` nas queries do dashboard.
- Mensagens padrão ficam como texto inicial editável no diálogo (o treinador pode ajustar antes de enviar).
- Nada é automático: todos os envios exigem clique + confirmação.

## Passos de implementação

1. Ajustar `RenewalsAndCyclesPanel.tsx`: query com `phone`, botão + diálogo de lembrete, envio WhatsApp.
2. Ajustar `DashboardAlerts.tsx`: query com `phone`/`email`, botão + diálogo de parabéns, envio WhatsApp.
3. Conectar Resend + criar edge function `send-email` e ligar ao botão de aniversário para o canal de e-mail.
