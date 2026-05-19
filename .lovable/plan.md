## Contexto e análise de impacto

Hoje o fluxo do aluno em `/inscricao/:slug` faz **três coisas no mesmo passo**:

1. Cadastra o aluno (`students.insert`)
2. Obriga a escolher um plano (`selected_plan_id` obrigatório)
3. Cria customer no Asaas
4. Redireciona automaticamente para `/pagamento/:studentId`

Isso é o que está gerando conflito — qualquer falha no Asaas, plano inativo ou pagamento incompleto deixa o aluno num estado intermediário difícil de recuperar, e o treinador não consegue cadastrar um aluno "só para acompanhar" sem já cobrar.

A proposta é separar de forma limpa em **dois links independentes**, cada um com responsabilidade única:

| Etapa | URL | Quem usa | O que faz |
|---|---|---|---|
| **Cadastro** | `/inscricao/:slug` | Aluno (link público da empresa) | Coleta dados pessoais, cria `student` com `status='pending'`. Sem plano, sem Asaas, sem pagamento. |
| **Pagamento** | `/pagamento/:studentId` | Aluno (link individual enviado pelo treinador) | Escolhe plano, escolhe Pix/Cartão, paga. Cria customer Asaas sob demanda. |

O `/pagamento/:studentId` já funciona hoje de forma independente (tem step `select_plan` próprio e carrega plano via `public-payment-context`). A separação é viável sem reestruturar nada grande.

## O que muda

### 1. `src/pages/PublicRegistration.tsx`
- **Remover** o campo "Plano *" (`Select` de planos) do formulário.
- **Remover** `selectedPlanId` do `state` e do payload do submit.
- **Remover** o bloco que chama `asaas-integration / create-customer` após o insert (linhas 128–150).
- **Remover** o `useState<Plan[]>` e o carregamento de `plans` no `init()` (a função `context` pode continuar devolvendo, mas o front ignora).
- **Trocar a tela de sucesso (`done`)**: deixar de mostrar o botão "Ir para Pagamento". Substituir por:
  > "Cadastro recebido. Em breve seu treinador entrará em contato com o link para escolher o plano e finalizar o pagamento."
- A validação de "Campos obrigatórios" perde o item "Plano".

### 2. `supabase/functions/public-registration/index.ts`
- Manter a `action: "context"` como está (devolver `plans` é inofensivo — usado em outras telas).
- Em `action: "register"`: tornar `selected_plan_id` definitivamente **opcional** (já é tecnicamente, mas adicionar comentário e validar só se vier). Sem outras mudanças.

### 3. `src/pages/PublicPayment.tsx`
- Funciona como está. Pequeno ajuste defensivo: se o `student.selected_plan_id` vier `null` (que será o caso novo padrão), o componente já abre direto em `step: "select_plan"` — comportamento correto, só confirmar.
- Garantir que `asaas-integration / create-payment` cria o customer sob demanda caso ainda não exista (ler `supabase/functions/asaas-integration/index.ts` para confirmar; se não cria, adicionar fallback). Esta é a única peça que pode quebrar quando o cadastro deixa de pré-criar o customer.

### 4. Painel admin — facilitar envio do link de pagamento
No painel onde o admin/treinador vê os alunos (provavelmente `src/pages/admin/StudentsManager.tsx` e/ou `StudentDetail.tsx`), adicionar dois botões discretos por aluno:

- **"Copiar link de pagamento"** → copia `${window.location.origin}/pagamento/${student.id}` para o clipboard, com `toast` de confirmação.
- (Opcional, se ainda não existir) **"Copiar link de cadastro"** no nível da empresa → copia `${window.location.origin}/inscricao/${company.slug}`.

Isso fecha o loop operacional: o treinador cadastra o aluno (ou recebe o cadastro via link público), depois envia o link de pagamento individualmente por WhatsApp quando for cobrar.

### 5. Nenhuma mudança em
- Schema do banco (`students.selected_plan_id` continua nullable).
- RLS, roles, autenticação.
- Webhook do Asaas (`asaas-webhook`) — continua ativando o aluno no `RECEIVED/CONFIRMED`.
- Fluxos internos do app (treinador, master, aluno logado).

## Detalhes técnicos

- O estado intermediário hoje é `students.status = 'pending'` (já existe). Continua sendo o estado pós-cadastro. A transição para `'active'` acontece via `asaas-webhook` quando o pagamento confirma — já implementado, sem mudança.
- Como o customer Asaas não é mais criado no cadastro, a primeira chamada de `create-payment` em `/pagamento/:studentId` precisa garantir que o customer existe. **Ação:** abrir `supabase/functions/asaas-integration/index.ts` durante a implementação e, se `create-payment` não chamar `create-customer` automaticamente quando o `students.asaas_customer_id` está nulo, adicionar esse fallback (1 if antes do create-payment).
- O link `/pagamento/:studentId` usa o UUID do aluno — já é não-enumerável, seguro para enviar por WhatsApp sem auth.
- Nenhuma migração necessária.

## Pontos a confirmar antes de implementar

1. Na tela de sucesso do cadastro, é melhor **esconder totalmente** o link de pagamento (a mensagem fala "treinador entrará em contato") ou **mostrar também** o link para o aluno copiar caso o treinador queira agilizar? Minha sugestão: esconder, para forçar o controle do treinador — mas confirme.
2. Posso adicionar os botões "Copiar link de pagamento" / "Copiar link de cadastro" no painel admin, ou esses links já existem em algum lugar que prefere reutilizar?
