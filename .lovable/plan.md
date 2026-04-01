

# Plano: Dados Simulados, Aba Treinos e BodyMap nas Análises

## 3 Entregas

### 1. Inserir dados simulados de treino para Syer Rodrigues
- Criar uma migration SQL que insere `workout_logs` realistas para o aluno Syer Rodrigues
- Buscar o `student_id`, `workout_id` e exercícios prescritos via subqueries
- Gerar logs com pesos, repetições e datas variados nos últimos 30 dias
- Isso fará os cards de sessões, aderência, volume e a tabela muscular mostrarem dados reais

### 2. Adicionar aba "Treinos" no detalhe do aluno
- Nova aba entre "Programa" e "Análises" no `StudentDetail.tsx`
- Conteúdo: lista dos treinos (A, B, C...) do ciclo ativo com exercícios, séries, reps e notas
- Cada treino mostra o BodyMap com distribuição muscular daquele treino específico
- Link para abrir o WorkoutBuilder do ciclo correspondente

### 3. Substituir tabela muscular por BodyMap na aba Análises
- No `WorkoutAnalysis.tsx`, trocar a tabela "Volume por Grupamento Muscular" pelo componente `BodyMap` já existente
- Passar os dados de `muscleData` (nome + totalVolume) para o `BodyMap`
- Manter os cards de resumo (sessões, aderência, duração, volume) e a barra de aderência
- Manter os alertas de sub/sobre-treinamento abaixo do BodyMap
- Layout: BodyMap centralizado com a legenda de calor, seguido pela lista de alertas

## Detalhes técnicos

**Arquivos modificados:**
- `supabase/migrations/` — nova migration para inserir workout_logs simulados
- `src/pages/admin/StudentDetail.tsx` — adicionar TabsTrigger "Treinos" e TabsContent com lista de treinos + BodyMap por treino
- `src/components/trainer/WorkoutAnalysis.tsx` — importar `BodyMap`, substituir `<Table>` pela visualização com bonecos

**Componente `BodyMap` já existe** em `src/components/student/BodyMap.tsx` com SVG frente/costas e heatmap por intensidade. Só precisa receber os dados corretos do `WorkoutAnalysis`.

**Mapeamento de nomes:** O BodyMap já suporta nomes como "Quadríceps", "Peitoral", "Dorsal", "Bíceps", "Tríceps", "Panturrilha", "Glúteos" via fuzzy match — compatível com os nomes vindos da tabela `muscle_groups`.

