# CardioPlanView — Planos de cardio no app do aluno

Exibir os `running_plans` (corrida, natação, ciclismo, triathlon) já existentes no banco dentro do portal do aluno, com progresso do plano e destaque dos próximos treinos. Segue o mesmo padrão visual/navegação do `NutritionPlanView`.

## O que será criado

**Novo componente `src/components/student/CardioPlanView.tsx`**

Carrega o plano de cardio ativo mais recente do aluno (RLS já garante acesso só ao próprio) e renderiza:

1. **Cabeçalho do plano** — nome do plano, esporte (badge com ícone por modalidade: corrida/natação/ciclismo/triathlon), objetivo (`goal`) e modelo (`model`: polarizado/piramidal).

2. **Barra de progresso do plano** — calcula a semana atual a partir de `created_at` + número de dias decorridos (`semana_atual = floor(dias/7)+1`, limitada a `duration_weeks`). Mostra "Semana X de Y" com `Progress`.

3. **Próximos treinos** — a partir da semana atual em `weeks[].sessions[]`, lista as sessões da semana ordenadas por dia (Seg→Dom), destacando o próximo treino (dia ≥ hoje). Cada sessão mostra: dia, título, esporte, tipo/zona, duração total (`total_min`), distância (`distance_km`), FC alvo (`fc_target`), intervalos e notas.

4. **Zonas de FC** — card com as 5 zonas de `fc_zones` (z1–z5 min/max, fcmax, fcrep). Exibe aviso quando `fc_zones.estimated = true`.

5. **Alertas e dicas** — `warnings[]` (linhas vermelhas de segurança), `nutrition_alert`, `general_tips` e `complementary_strength[]` (exercícios preventivos), cada um em seu bloco.

6. **Estado vazio** — quando não há plano, card com ícone e "Nenhum plano de cardio disponível ainda." (igual ao padrão de nutrição).

## Integração no portal

**`src/pages/student/StudentPortal.tsx`**
- Adicionar `"cardio"` ao tipo `ActiveView`.
- Adicionar `cardio: "CARDIO"` em `viewTitles`.
- Renderizar `{activeView === "cardio" && studentId && <CardioPlanView studentId={studentId} />}` junto das demais views.
- Importar o novo componente.

**`src/components/student/StudentHome.tsx`**
- Adicionar `"cardio"` à assinatura de `onNavigate`.
- Novo botão-card "Cardio / Corrida" (ícone de corrida, ex.: `Footprints` ou `HeartPulse` do lucide) com legenda "Corrida, natação e ciclismo", no mesmo grid dos demais atalhos.
- O `handleNavigate` do portal já repassa o valor para `setActiveView`, então não precisa mudar a lógica.

## Detalhes técnicos

- Consulta: `supabase.from("running_plans").select(...).eq("student_id", studentId).order("created_at", {ascending:false}).limit(1).maybeSingle()`. Não há coluna `status` na tabela, então usamos o mais recente (mesmo critério de fallback do padrão existente).
- Tipagem local para as estruturas jsonb (`weeks`, `fc_zones`, `safety_check`, `complementary_strength`) via interfaces no próprio arquivo, com casts `as unknown as` (mesmo padrão do `NutritionPlanView`).
- Ordenação de dias por mapa `{Segunda:1,...,Domingo:7}`; sessões `descanso` exibidas de forma discreta.
- Somente leitura/apresentação — nenhuma mudança de banco, RLS ou edge function. As policies de `running_plans` já permitem o aluno ler o próprio plano.
- Componentes de UI reaproveitados: `Card`, `Badge`, `Progress`, ícones lucide, tokens semânticos de tema (sem cores hardcoded).

## Fora de escopo
- Não altero a geração do plano (`ai-running-plan`) nem a prescrição pelo treinador.
- Não crio registro/seed de dados — a view lida com o estado vazio até existir um plano prescrito.