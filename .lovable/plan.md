## Problemas identificados

1. **Grupos musculares não carregam** — a query `muscle_groups?order=sort_order.asc` retorna **400** (`column "sort_order" does not exist`). Como o dropdown de grupos fica vazio, o cadastro/edição de exercícios não consegue mostrar nem salvar primário/secundário, e o card só exibe o texto legado `ex.muscle_group` (um único grupo).

2. **Cards de exercícios só mostram um grupo** — o componente nunca consulta `exercise_muscle_targets` na listagem; só aparece a badge legada.

3. **Sem coluna de volume por empresa** — hoje `exercise_muscle_targets.volume_percentage` é global. Precisa existir um override por empresa (ex.: BN pode dizer que Agachamento conta 70% Quadríceps / 30% Glúteo, e outra empresa 60/40).

4. **Treinador não consegue clicar em "Ativar Acesso"** — a edge `activate-student-access` já permite role `trainer`, então o erro é runtime. Preciso instrumentar e validar pelos logs.

## Plano

### 1. Corrigir ordenação de `muscle_groups`
Em `src/pages/admin/ExerciseLibrary.tsx` (e qualquer outro lugar que use `sort_order` em muscle_groups) trocar para `.order("name")`. Sem migration — o schema não tem `sort_order`.

### 2. Mostrar primário/secundário nos cards
Em `ExerciseLibrary.tsx`, na carga inicial buscar `exercise_muscle_targets` de todos os exercícios listados em uma única query (`in("exercise_id", ids)`) e indexar por `exercise_id`. Renderizar:
- badges `Primário: <nome> (xx%)` 
- badges `Secundário: <nome> (xx%)`
Mantém a badge legada como fallback quando o exercício ainda não tem targets.

### 3. Volume por empresa (nova tabela)
Migration criando:

```text
company_exercise_volumes
├─ id uuid pk
├─ company_id uuid not null
├─ exercise_id uuid not null
├─ muscle_group_id uuid not null
├─ role text ('primary'|'secondary')
├─ volume_percentage numeric not null
├─ created_at / updated_at
└─ UNIQUE(company_id, exercise_id, muscle_group_id)
```

RLS company-scoped (mesmo padrão de `exercise_muscle_targets`):
- SELECT: `company_id = get_user_company_id(auth.uid())` ou master
- INSERT/UPDATE/DELETE: admin/coordinator/trainer da mesma empresa, ou master

No editor de exercício (`ExerciseLibrary`), abaixo da seleção de primário/secundário, adicionar uma seção **"Volume desta empresa"** que carrega `company_exercise_volumes` da empresa atual e permite editar a % por grupo. Salvar via upsert com `onConflict: "company_id,exercise_id,muscle_group_id"`.

Na listagem do card, se houver override da empresa atual, exibir esse % no lugar do default.

### 4. Diagnosticar "Ativar Acesso" do treinador
- Checar `supabase--edge_function_logs activate-student-access` para ver o erro real quando trainer chama.
- Se for falha de CORS/preflight, alinhar headers; se for `auth.admin.generateLink`/`createUser` retornando algo, propagar mensagem real (hoje muitos paths devolvem `data.error` truncado).
- Adicionar logs `console.error` na função e tratamento que devolva a mensagem original ao toast.
- Como mitigação imediata: trocar o `fetch` em `StudentDetail.tsx` por `supabase.functions.invoke("activate-student-access", { body: ... })` para garantir auth/headers consistentes.

## Detalhes técnicos

- Arquivos editados: `src/pages/admin/ExerciseLibrary.tsx`, `src/pages/admin/StudentDetail.tsx`, `supabase/functions/activate-student-access/index.ts`.
- Migration nova: `company_exercise_volumes` + policies + trigger `update_updated_at_column`.
- Sem alteração na tabela `muscle_groups` (mantemos ordenação por nome).
- Sem mudança em `exercise_muscle_targets` — ela continua sendo o "padrão global" do exercício; o override fica em `company_exercise_volumes`.

## Validação

1. Recarregar `/master/exercises`: dropdown de grupos volta a aparecer; cards mostram primário/secundário com %.
2. Editar um exercício como admin BN: definir volume próprio; ao reabrir, valores persistem; outro admin de outra empresa não vê esses valores.
3. Treinador BN abre ficha de aluno e clica em "Ativar Acesso" → senha temporária aparece no toast (ou erro real e legível).
