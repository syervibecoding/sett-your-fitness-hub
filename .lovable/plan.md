# Relatório de Viabilidade — Importar melhorias do `bn-performance-app`

Comparei o repositório com o projeto atual. O repo está ~16 migrations e dezenas de arquivos à frente. Abaixo, cada bloco com **o que é**, **o que falta no banco**, **edge functions**, **dependências**, **esforço** e **risco**. Nada será alterado até você aprovar uma fase.

## Visão geral de dependências novas
- **Dependência npm:** apenas `jspdf` (para PDFs da prescrição).
- **Tabelas que NÃO existem aqui:** `company_ai_config`, `nutrition_plans`, `assessment_frames`, `anamnese_invites`, `ai_decision_logs`, `student_files` (e possivelmente `ai_plan_versions`).
- **Edge functions novas:** `ai-bnito-coach`, `ai-coach-pack`, `ai-student-bnito`, `ai-nutrition-plan`, `ai-nutrition-meals`, `ai-validate-prescription`, `youtube-exercise-video`, `student-workout-feedback`, `student-login-credentials`.
- **Secrets:** todas as edges de IA usam `LOVABLE_API_KEY` (já existe). `youtube-exercise-video` pode exigir chave do YouTube (a confirmar na implementação).

---

## Bloco 1 — Área do aluno
**O que entra:** `NutritionPlanView` (plano por refeição + macros + hidratação), `CardioPlanView` (corrida/natação/ciclismo só se prescrito), `MonthlyLeaderboard` (ranking mensal anônimo via `xp_events` + RPC `get_student_rank` — já existe), `VolumeInsights`, `WarmupGuide`, `PeriodizationBanner`, `AnnouncementsBell`, e popup "Como foi o treino?" → WhatsApp.

- **Banco:** precisa de `nutrition_plans` (nova). Ranking/volume reutilizam `xp_events`, `workout_logs`, `prescription_bundles` (já existem).
- **Edge:** `student-workout-feedback` (feedback pós-treino → WhatsApp).
- **Esforço:** médio. **Risco:** baixo (componentes de UI; só o feedback toca WhatsApp/Evolution, já configurado).
- **Dica:** `MonthlyLeaderboard`, `VolumeInsights`, `WarmupGuide`, `PeriodizationBanner`, `AnnouncementsBell` podem entrar isolados sem migration. Nutrição/Cardio dependem de prescrição (Bloco 4) para terem dados.

## Bloco 2 — Biblioteca de exercícios
**O que entra:** `Biblioteca.tsx` + `WorkoutLibrary.tsx` (catálogo ~447 exercícios curados), vídeo por exercício via `youtube-exercise-video` + `exerciseCover.ts`, upload próprio (bucket `exercises-videos` já existe).

- **Banco:** usa `exercise_library` existente; pode exigir colunas extras (cover/metadata) — a validar contra a migration do repo.
- **Edge:** `youtube-exercise-video`.
- **Conteúdo:** os 447 exercícios + curadoria vivem em migrations/seeds + ~100 docs de curadoria (não precisam vir; só os dados).
- **Esforço:** médio. **Risco:** baixo-médio (volume de dados de seed e possível chave do YouTube).

## Bloco 3 — Studio de IA por empresa (white-label)
**O que entra:** `AICoachHub.tsx` ("Central de IA") + `companyAiConfig.ts` + `useAssistantName` + `BnitoFloatingAssistant` (assistente flutuante). Cada empresa define nome do assistente (padrão "Setty"; BN = "BNITO"), metodologia, tom, doutrina, limites éticos. `Questionarios.tsx` unifica Cadastro + Anamnese.

- **Banco:** nova tabela `company_ai_config` (DDL pronta no repo, com RLS por `company_id` + master). Persona detalhada vai em `extra jsonb`.
- **Edge:** `ai-bnito-coach`, `ai-coach-pack`, `ai-student-bnito` (todas `verify_jwt = true`, usam `LOVABLE_API_KEY`).
- **Esforço:** médio-alto. **Risco:** médio (toca IA Gateway, custo por requisição, e persona por empresa precisa de UI de onboarding).

## Bloco 4 — Prescrição (motor determinístico v1 + Studio)
**O que entra:** `PrescriptionStudio.tsx` (`/admin/studio`): anamnese → avaliação por vídeo → prescrição → PDFs. `lib/prescription/` (engine, presets, methodology, volumeRules, progressionRules, restrictionRules, explanations, validator + testes). `generatePDFs.ts`, `prescriptionIntegration.ts`, `periodization.ts`. Avaliação funcional por vídeo (`assessment_frames`), laudo em PDF e prescrição que cai direto no app do aluno.

- **Banco:** novas `nutrition_plans`, `assessment_frames`, `anamnese_invites`, `ai_decision_logs` (opcional), possivelmente `ai_plan_versions`, `student_files`. Todas precisam de RLS escopada por `company_id`.
- **Edge:** `ai-validate-prescription`, `ai-nutrition-plan`, `ai-nutrition-meals` (+ ajustes em `ai-prescribe-workout`/`ai-running-plan`/`ai-functional-assessment`).
- **Dependência npm:** `jspdf`.
- **Esforço:** ALTO (bloco mais profundo). **Risco:** alto (maior superfície: migrations múltiplas, deploy de edges, motor com testes, integração multimodal aluno↔treino↔nutrição).

---

## Ordem recomendada (cada fase é incremental e testável)
```text
Fase A  Bloco 1 (parte sem banco): Leaderboard, VolumeInsights, Warmup,
        PeriodizationBanner, AnnouncementsBell  → ganho rápido, risco baixo
Fase B  Bloco 2: Biblioteca + vídeo YouTube por exercício
Fase C  Bloco 3: company_ai_config + Central de IA + assistente por empresa
Fase D  Bloco 4: motor de prescrição + Studio + PDFs (+ nutrição/cardio do Bloco 1)
```

## Observações importantes
- Cada tabela nova exige migration com **GRANT + RLS por `company_id`** (padrão do projeto). Eu trago a DDL do repo adaptada.
- Edge functions deployam automaticamente aqui; não há a restrição "rodar local sem deploy" que o repo tinha.
- Vou validar colunas extras em `exercise_library` e o schema real de `nutrition_plans`/`assessment_frames` direto nas migrations do repo antes de cada fase.
- O custo de IA (Gateway) só aparece nos Blocos 3 e 4.

**Próximo passo:** me diga se aprova este faseamento (A→B→C→D) ou se quer reordenar/cortar algo. Ao aprovar uma fase, eu detalho a migration e os arquivos exatos antes de implementar.
