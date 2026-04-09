

# Mostrar professor atribuído nos cards "Definir Data de Treino" e "Sem Treino no Ciclo"

## Problema
Os cards "Definir Data de Treino" e "Sem Treino no Ciclo" no dashboard não mostram qual treinador está atribuído ao aluno.

## Solução — `src/components/DashboardAlerts.tsx`

### 1. Adicionar `trainer_name` às interfaces
- `AwaitingTrainingDate`: adicionar campo `trainer_name?: string`
- `MissingWorkout`: adicionar campo `trainer_name?: string`

### 2. Buscar nome do treinador nos dados

**Definir Data de Treino (linha 85):** Alterar a query de enrollments para incluir `trainer_id` e fazer um lookup nos profiles:
```typescript
supabase.from("enrollments")
  .select("id, student_id, trainer_id, students(full_name)")
```

**Sem Treino no Ciclo (linha 94):** Mesma alteração:
```typescript
supabase.from("enrollments")
  .select("id, student_id, trainer_id, students(full_name)")
```

Após obter os `trainer_id`s únicos, buscar nomes na tabela `profiles` (mesmo padrão já usado no `AdminAgenda.tsx`).

### 3. Exibir nome do treinador no card

Adicionar uma linha abaixo do nome do aluno em ambos os cards:
```
Juliana Campos Nardo
Ciclo 8 — 29/03/2026 a 09/05/2026
Matheus Loreto                        ← nova linha
```

Texto em `text-xs text-muted-foreground/70`, mesmo estilo usado na agenda.

### Escopo
- 1 arquivo alterado: `DashboardAlerts.tsx`
- Sem mudanças no banco

