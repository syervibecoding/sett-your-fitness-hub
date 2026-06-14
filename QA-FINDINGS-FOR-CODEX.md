# QA — Achados para o Codex (lane de IA / edge functions)

> Gerado pela fase de QA do Claude (ATENA) em 2026-06-14. Os bugs abaixo estão na **sua lane**
> (`supabase/functions/ai-*`, prompts, validador, contratos, e o flow de IA do WhatsApp/CRM).
> O Claude já corrigiu e commitou (`882f1b0`) os 8 bugs da lane dele (aluno/UI/componentes novos).
> **Não toquei nestes arquivos** para não colidir com seu trabalho in-flight. Cada item tem o fix sugerido.

## 🔴 CRÍTICO

### 1. Cross-tenant write/read nas edge functions de IA
`ai-functional-assessment`, `ai-prescribe-workout`, `ai-nutrition-plan`, `ai-running-plan`, `ai-validate-prescription`
validam o JWT (`requireUser`/`getClaims`) mas **confiam no `company_id`/`student_id` do body** e gravam com
`service_role` (bypassa RLS). `grep` por `get_user_company_id`/`has_role` nessas funções = 0 (só `ai-coach-pack` checa).
→ Um usuário logado da empresa A pode gravar `functional_assessments`/`ai_strength_plans`/`ai_decision_logs` na
empresa B e ler a metodologia/white-label dela.
**Fix:** depois do `requireUser`, resolver o company do usuário (`get_user_company_id(userId)`), rejeitar se
`body.company_id !== userCompany` (exceto master), e validar `students.company_id === userCompany` para o `student_id`.
Mesmo padrão que `whatsapp-manager` já aplica (linhas ~79-93).

### 2. Validador "blocker" é cosmético — plano é persistido ANTES de validar
`ai-prescribe-workout` insere em `ai_strength_plans` antes de retornar; só depois o cliente chama
`ai-validate-prescription` e dá `throw` no blocker. O plano bloqueado **já está salvo**.
**Fix:** validar ANTES de persistir (validar dentro da própria `ai-prescribe-workout`, ou retornar o plano sem
salvar e só persistir após o validador passar), ou apagar/marcar o plano em caso de blocker.

## 🟠 MÉDIO

### 3. Filter injection no `.or()` com `company_id` cru
`ai-validate-prescription` (~L77) e `ai-prescribe-workout` (~L234): `query.or(\`is_global.eq.true,company_id.eq.${companyId}\`)`
interpola `company_id` do body (não validado) direto no filtro PostgREST → dá pra injetar operadores.
**Fix:** validar que `company_id` é UUID antes de interpolar (ou usar o company já validado do usuário).

### 4. Mismatch de key OHS: `overhead_arm_asymmetry` vs `arm_asymmetry`
`ai-functional-assessment` emite `key:"overhead_arm_asymmetry"`; `src/lib/aiContracts.ts` (`OHS_COMPENSATION_KEYS`)
usa `"arm_asymmetry"`. `normalizeAssessmentContract` casa por key → a assimetria de braço **nunca casa** e cai em
"ausente". Hoje só morde nos testes (a lib ainda não é consumida na UI), mas é bomba-relógio.
**Fix:** unificar a key (sugiro `overhead_arm_asymmetry` nos dois, já que a edge é quem persiste).

### 5. `bnito_intent` do validador é dead output
`ai-validate-prescription` retorna `bnito_intent.type = "notify_student_prescription_ready"`, mas nenhuma UI lê isso
(UnifiedPrescriber/WorkoutBuilder só leem `data.result`; o "avisar aluno" vem de `bnito_after_generation`/`next_intent`).
**Fix:** escolher a fonte canônica do intent e remover as outras (hoje há 3 formatos pra mesma intenção).

### 6. Handoff de DOR do aluno (`ai-student-bnito`)
- (a) Se o INSERT em `admin_alerts` falhar, `createPainAlert` retorna `{error}` mas o aluno ainda recebe "a equipe
  será avisada" → **falso negativo de segurança**. Surfaçar `team_alert_created` e tratar falha como erro.
- (b) `createPainAlert` insere `enrollment_id = NULL` → o índice único `uniq_admin_alerts_open_per_enrollment_type`
  não dedupa NULLs → toda menção a "dor"/"ombro"/"peito"/"falta de ar" cria um alerta novo (inclui falsos positivos
  tipo "como evito dor muscular?"). Preencher `enrollment_id` e refinar o regex `isPainReport`.

### 7. Broadcast do WhatsApp CRM (`src/pages/admin/WhatsAppCRM.tsx`)
- (a) Só interpola `{{nome}}`/`{{primeiro_nome}}`; `{{plano}}`/`{{vencimento}}`/`{{valor}}`/`{{dias_restantes}}` viram
  string vazia no disparo em massa (a UI de templates anuncia que existem). Popular por destinatário a partir do
  `CRMStudent` já carregado, ou avisar na UI.
- (b) Sem guarda quando `effectiveCompanyId` é null (master fora do company-view) → manda `companyId: null`.

### 8. Validador manual do WorkoutBuilder sem contexto real
`WorkoutBuilder` (~L363-396) chama o validador com `fitness_level:"intermediario"`/`objective:"manual"` fixos e **sem**
anamnese/avaliação → as regras de iniciante/dor/compensação nunca disparam no fluxo manual (só pega exercício fora da
biblioteca). Carregar e passar nível/objetivo + anamnese/avaliação reais do `cycleInfo.student_id`.

### 9. `asaas-integration` sem checagem de tenant/role por ação
O fix de preço (`resolvePlanPrice`) **continua válido**, mas qualquer usuário logado cria cobrança/cliente para
`studentId`/`companyId` arbitrários (service_role, sem checar role nem empresa). Adicionar checagem como no
`whatsapp-manager`. _(Você já está editando este arquivo — talvez já esteja resolvendo.)_

## 🟡 BAIXO / NOTA

- **Automação morta (não é risco, é o oposto):** `process_automation_triggers` cria `flow_sessions` com `status='active'`,
  mas nenhum dispatcher envia a 1ª mensagem (o webhook só retoma `status='waiting_response'`). `weekly_contact`/
  `no_workout_7d`/`cart_recovery` geram sessões paradas. Precisa de um dispatcher (edge/cron) que rode `executeFlow`
  nas sessões `active` novas. Confirma que **não há spam** — o toggle `weekly_contact_enabled` e `is_active` são
  respeitados no SQL.
- "Avisar aluno" no WorkoutBuilder aparece desacoplado do save (pode avisar sem ter salvado). Gate no save OK.
- `set_progress_photo_company_id` só seta `company_id` quando NULL — preferível setar SEMPRE a partir do student.

---
**Como o Claude vai integrar:** quando você commitar (`codex:`), eu puxo, rodo `npm run build`/`npm run test` e
verifico a junção. Os 8 fixes do Claude (`882f1b0`) não tocam suas funções `ai-*`.
