## Objetivo

Evoluir o construtor **Montar Treino** (`src/pages/admin/WorkoutBuilder.tsx`) com: seleção múltipla na biblioteca, agrupamento de 2+ exercícios (Bi-set, Tri-set, Super-set, Série gigante, Circuito) com definições explicativas, painel BNITO como placeholder (sem conexão) e um painel de limitações reais lidas da anamnese do aluno. O agrupamento é salvo no treino e exibido também na visão do aluno.

Sem mudanças de banco: o agrupamento entra como campos novos dentro do JSONB `workouts.exercises`, e as limitações já existem em `student_body_limitations`.

## 1. Biblioteca com seleção múltipla

Na dialog "Biblioteca de exercícios":
- Cada item ganha um checkbox; clicar seleciona/desseleciona (mantém o filtro por boneco/busca/grupo atual).
- Rodapé fixo com contador "N selecionado(s)" e botão **Adicionar selecionados (N)**, que insere todos de uma vez no treino-alvo.
- Itens já adicionados aparecem marcados/desabilitados como hoje.

## 2. Modelo de dados do exercício (JSONB, sem migração)

Adicionar dois campos opcionais em cada exercício do treino:

```text
group_id?:   string   // id compartilhado pelos exercícios do mesmo agrupamento
group_type?: 'bi_set' | 'tri_set' | 'super_set' | 'giant_set' | 'circuit'
```

Atualizar a interface `WorkoutExercise` no construtor e na visão do aluno (`StudentPortal.tsx`). Como `handleSaveAll` já grava o array `exercises` inteiro, o agrupamento é persistido automaticamente.

## 3. Agrupar exercícios no construtor

Em cada treino:
- Modo de seleção: checkbox em cada card de exercício.
- Ao ter 2+ selecionados, aparece uma barra de ações: **agrupar:** `Bi-set` · `Tri-set` · `Super-set` · `Série gigante` · `Circuito` · `Desagrupar`.
- Ao escolher um tipo: gera um `group_id`, aplica `group_type` aos selecionados e os **reordena para ficarem contíguos** (necessário para o "colchete" visual). "Desagrupar" limpa os campos.
- Cada opção de agrupamento tem um ícone de informação com **tooltip/definição**:
  - Bi-set: 2 exercícios em sequência, sem descanso entre eles.
  - Tri-set: 3 exercícios em sequência, sem descanso.
  - Super-set: 2 exercícios de músculos antagonistas em sequência.
  - Série gigante: 4+ exercícios seguidos para o mesmo grupo.
  - Circuito: vários exercícios em sequência, descanso só ao final da volta.
- Visual do grupo: borda/etiqueta colorida à esquerda dos cards do mesmo `group_id` + badge com o rótulo (ex.: "SUPER-SET").

## 4. Visão do aluno

Em `StudentPortal.tsx`, ao renderizar `selectedWorkout.exercises` (lista de `ExerciseCard`):
- Detectar sequências consecutivas com mesmo `group_id` e envolvê-las com um cabeçalho/colchete e um badge do rótulo do agrupamento.
- Exercícios sem `group_id` continuam exibidos normalmente.

## 5. Painel BNITO (placeholder)

Adicionar um card "BNITO — Copiloto técnico" no construtor:
- Botão **Auditar treino** desabilitado com legenda "em breve" e um campo de pergunta desabilitado.
- Sem nenhuma chamada a edge function (não conectar agora).

## 6. Painel de limitações reais

No construtor, carregar as limitações do aluno do ciclo:
- Resolver `student_id` via `training_cycles → enrollments` (já feito em `loadCycleInfo`).
- Buscar `student_body_limitations` (region, type, severity, note) desse aluno.
- Exibir card read-only listando cada limitação (região · tipo · gravidade · observação), com destaque para gravidade severa.
- Se não houver nenhuma: "Nenhuma limitação registrada na anamnese."

## Detalhes técnicos

- Arquivos alterados: `src/pages/admin/WorkoutBuilder.tsx` (principal), `src/pages/student/StudentPortal.tsx` e possivelmente `src/components/student/ExerciseCard.tsx` (apenas para o invólucro/badge de grupo).
- Sem migração, sem edge function, sem alteração de RLS.
- Tokens semânticos do design system para as cores dos badges/bordas de grupo (nada de cores hardcoded).
- Retrocompatível: treinos antigos sem `group_id` seguem funcionando igual.

## Fora de escopo (por ora)

- Técnicas por exercício (drop-set/rest-pause/cluster/isometria/picos) — os tipos de série W/Normal/F/D atuais permanecem.
- Conexão real da IA BNITO.
- Abas de categoria da biblioteca (Mobilidade, Controle Motor etc.).