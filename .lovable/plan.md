# Envio automático de login ao ativar acesso

Hoje o botão **"Ativar Acesso"** apenas gera uma senha temporária e mostra num toast para copiar e repassar à mão. Vamos fazer o sistema **enviar automaticamente as credenciais de login** (link de acesso + e-mail + senha temporária) por **WhatsApp e e-mail** assim que o acesso for ativado.

## Comportamento

Ao clicar em "Ativar Acesso":
1. Gera/renova a senha temporária (como já faz hoje).
2. **Dispara automaticamente**:
   - **WhatsApp** — pelo número do aluno, via Evolution API (já conectada).
   - **E-mail** — para o e-mail cadastrado do aluno.
3. A tela mostra um resumo do que foi enviado (ex.: "Enviado por WhatsApp ✓ e e-mail ✓"), e ainda exibe a senha temporária caso você precise repassar manualmente.
4. Se um canal falhar (ex.: aluno sem WhatsApp válido, ou e-mail não configurado), o outro ainda é enviado e a tela avisa o que não saiu — sem travar a ativação.

## Mensagem enviada

Conteúdo (WhatsApp e e-mail):
```text
Olá {nome}! Seu acesso ao Set Training App foi ativado.

Acesse: https://www.settapp.com.br/auth
E-mail: {email do aluno}
Senha temporária: {senha}

Recomendamos alterar a senha após o primeiro login.
```

## Detalhes técnicos

**Edge function `activate-student-access`**
- Após gerar a senha e vincular o usuário, montar a mensagem de login e disparar os dois canais.
- WhatsApp: reutilizar a infraestrutura da Evolution API já existente no `whatsapp-manager` (buscar o número do aluno e enviar texto). Validar número brasileiro; se inválido, marcar `whatsapp: false` no retorno.
- E-mail: enviar via **Resend** (serviço de e-mail transacional). Retornar `email: true/false`.
- Retorno passa a incluir: `temp_password`, `sent: { whatsapp: bool, email: bool }` e mensagens de erro por canal.

**Front-end `StudentDetail.tsx`**
- Atualizar `handleActivateStudentAccess` para exibir no toast o status de envio por canal, mantendo a exibição da senha temporária como fallback.

**Configuração de e-mail (Resend)**
- Este projeto usa um Supabase externo, então o envio de e-mail transacional será feito pela **Resend**. É uma configuração única: conectar a conta Resend (ou informar a API key) e verificar um domínio remetente para conseguir enviar aos alunos.
- Enquanto o e-mail não estiver configurado, o **WhatsApp já funciona normalmente** e o canal de e-mail é apenas marcado como "não enviado".

## Fora de escopo
- Não altera o fluxo de login/senha do aluno em si (a página `/auth` continua igual).
- Não cria página de "trocar senha no primeiro acesso" (a senha temporária continua válida até o aluno redefinir).
