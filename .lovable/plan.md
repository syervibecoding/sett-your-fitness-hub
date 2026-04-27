# Correção do 404 para Coordenador e Trainer

## Causa raiz

A `AppSidebar` lista, para o coordenador, itens de menu como **Cadastro**, **Anamnese**, **Planos**, **Equipe**, **Financeiro**, **Aparência** e **WhatsApp** apontando para `/coordinator/registration`, `/coordinator/anamnesis`, `/coordinator/plans`, `/coordinator/team`, `/coordinator/financial`, `/coordinator/appearance`, `/coordinator/whatsapp*`.

Porém, em `src/App.tsx`, **essas rotas não existem**. Hoje só estão registradas:
- `/coordinator`, `/coordinator/students`, `/coordinator/students/:id`
- `/coordinator/exercises`, `/coordinator/prescriptions`, `/coordinator/agenda`

Qualquer clique em um item não mapeado cai no `<Route path="*" element={<NotFound />} />` → tela "404 / Oops! Page not found" (exatamente o print enviado pelo Matheus).

O mesmo bug afeta o **trainer**: a sidebar lista `/trainer/registration`, `/trainer/anamnesis`, `/trainer/plans`, `/trainer/team`, `/trainer/financial`, `/trainer/appearance`, `/trainer/whatsapp*` — rotas que também não existem.

## O que vou fazer

### 1. Adicionar as rotas faltantes em `src/App.tsx`

Reaproveitar os mesmos componentes de página do admin (eles já são multi-tenant via `effectiveCompanyId` / RLS), envolvidos em `FeatureRoute` com o papel correto e a feature flag correspondente.

**Rotas novas para `coordinator`:**
- `/coordinator/registration` → `RegistrationManager` (feature `hasRegistration`)
- `/coordinator/anamnesis` → `AnamnesisManager` (feature `hasAnamnesis`)
- `/coordinator/plans` → `PlansManager` (feature `hasPlans`)
- `/coordinator/team` → `TeamManager` (feature `hasTeam`)
- `/coordinator/financial` → `FinancialDashboard` (feature `hasFinancial`)
- `/coordinator/appearance` → `AppearanceSettings` (feature `hasAppearance`)
- `/coordinator/whatsapp` → `WhatsAppSettings`
- `/coordinator/whatsapp-chat` → `WhatsAppChat`
- `/coordinator/whatsapp-crm` → `WhatsAppCRM`
- `/coordinator/whatsapp-templates` → `WhatsAppTemplates`
- `/coordinator/whatsapp-automation` → `WhatsAppAutomation`
- `/coordinator/workout/:cycleId` → `WorkoutBuilder` (necessário para abrir prescrições)

**Rotas novas para `trainer`** (mesma lista, prefixo `/trainer/...`).

Cada rota usa `FeatureRoute allowedRoles={["coordinator"]}` (ou `["trainer"]`) com a `requiredFeature` apropriada, mantendo o gating por tier da empresa.

### 2. Garantir que `FeatureRoute` respeite as permissões granulares

Confirmar que `FeatureRoute` já checa `useRolePermissions().canAccess(...)` para coordenador/trainer (a sidebar já filtra com `canAccess`, mas o ideal é que a rota também bloqueie acesso direto via URL). Se não estiver fazendo, adicionar a checagem para evitar bypass.

### 3. Verificação rápida de RLS

As páginas reusadas (Plans, Team, Financial, WhatsApp, Anamnesis, Registration) já são usadas por admin no mesmo `company_id`. As políticas RLS atuais permitem leitura/escrita por membros da empresa autenticados, então coordenador deve conseguir operar sem alterações de banco. Caso algum endpoint específico tenha policy restrita só a `admin`, ajusto pontualmente — mas isso será verificado durante a implementação e só corrigido se necessário (não vou afrouxar policies sem motivo).

## Arquivos alterados

- `src/App.tsx` — adicionar ~17 novas rotas (coordinator + trainer)
- `src/components/FeatureRoute.tsx` — (se necessário) reforçar checagem de `canAccess` por módulo

## Resultado esperado

O coordenador Matheus (e qualquer trainer) deixará de cair em 404 ao clicar em Cadastro, Planos, Anamnese, Equipe, Financeiro, Aparência ou WhatsApp na sidebar. Cada página abrirá normalmente, respeitando as permissões definidas em `useRolePermissions` e o tier da empresa.
