# Por que o Matheus continua vendo 404 em /cadastro

Verifiquei o código atual e a rota `/coordinator/registration` **já existe** em `src/App.tsx` (linha 122), apontando para `RegistrationManager`, com `FeatureRoute allowedRoles={["coordinator"]}`, `requiredFeature="hasRegistration"` e `requiredModule="registration"`. A `AppSidebar` aponta para a mesma URL. Logo, em `localhost`/preview a página abre normalmente.

A tela 404 que o Matheus enviou (print branco "Oops! Page not found") é renderizada por `src/pages/NotFound.tsx` — ou seja, ele caiu no catch‑all `path="*"`. Isso só pode acontecer em três cenários:

1. **O app publicado em `settapp.lovable.app` está desatualizado.** As rotas de coordenador/trainer foram adicionadas há poucas mensagens, mas o build publicado ainda é o antigo (sem essas rotas). Quando o Matheus clica em "Cadastro", a URL `/coordinator/registration` não existe no bundle dele e cai no `NotFound`. Esta é a hipótese mais provável.
2. **Cache do navegador / PWA do Matheus** servindo o `index.html` antigo. Mesmo após republicar, ele precisa dar um hard refresh (Ctrl+Shift+R) ou limpar o cache.
3. **Matheus está acessando uma URL diferente** da esperada (ex.: `/cadastro` direto, que é a rota pública e exige slug; sem slug abre o `PublicRegistration` em modo genérico — não dá 404, mas pode confundir). Vale confirmar exatamente qual URL aparece na barra dele.

# O que vou fazer

### 1. Pedir republicação

A correção das rotas só chega para o Matheus quando o app for publicado novamente. Vou orientar a clicar em **Publish** no Lovable para gerar o novo build em `settapp.lovable.app`. Em seguida, pedir ao Matheus um **hard refresh** (Ctrl+Shift+R no desktop / fechar e reabrir o app no celular).

### 2. Melhorar a página 404 (defensivo)

Hoje `NotFound.tsx` mostra só "404 / Oops! Page not found / Return to Home" em inglês e sem contexto. Vou:

- Traduzir para português ("Página não encontrada").
- Logar `location.pathname` + `role` no console para facilitar diagnóstico futuro.
- Trocar o link "Return to Home" por um botão que leva ao dashboard correto do papel (coordinator → `/coordinator`, trainer → `/trainer`, admin → `/admin`, master → `/master`, student → `/aluno`).
- Aplicar o design system (cores semânticas, Bebas no título).

Isso não resolve o 404 em si, mas evita que, num próximo bug de rota, o usuário fique perdido — ele cai num botão que volta ao painel correto.

### 3. Verificação rápida no preview

Antes de finalizar, vou abrir o preview, simular acesso a `/coordinator/registration` (com a sessão de master "viewing" uma empresa, se necessário) e confirmar que renderiza o `RegistrationManager` sem cair no `NotFound`.

# Arquivos alterados

- `src/pages/NotFound.tsx` — refatorar para PT‑BR, design system e redirecionamento por papel.

# Resultado esperado

Depois de publicar, o Matheus passa a abrir `/coordinator/registration` normalmente. Caso ainda caia em 404 (por cache), o novo `NotFound` mostra mensagem clara em português e um botão "Voltar ao painel" que respeita o papel dele.

# Pergunta antes de implementar

Você consegue confirmar duas coisas com o Matheus?

1. Qual URL aparece na barra do navegador dele quando dá o 404? (precisa ser exatamente `/coordinator/registration`)
2. Ele está usando o `settapp.lovable.app` (publicado) ou o link de preview do Lovable?

Se for o `settapp.lovable.app`, basta **republicar** que o problema some — não precisa nem do passo 2 acima. Mas vou fazer o passo 2 mesmo assim como melhoria defensiva.
