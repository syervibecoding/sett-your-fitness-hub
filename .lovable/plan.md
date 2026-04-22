

## Erro ao abrir o perfil da Ludmila

### Causa raiz
A migração que cadastrei a Ludmila ontem criou a matrícula (`enrollments`) sem `end_date` e sem `trainer_id`. O `StudentDetail.tsx` chama `format(parseISO(active.end_date), "dd/MM/yyyy")` (linha 841) — passar `null` para `parseISO` gera o erro minificado **`null is not an object (evaluating 't.split')`** que aparece na tela.

Confirmado no banco:
```
enrollment df9fad52… → end_date: NULL, trainer_id: NULL
```

### Plano de correção

**1. Migration (dados): completar a matrícula da Ludmila**
- Definir `end_date = start_date + duration_days` do plano `88faf03c-c488-421f-af1d-d406fb4bb70f` (calculado dinamicamente a partir de `plans.duration_days` ou `duration_weeks * 7`).
- Definir `trainer_id` para o admin/owner da empresa `c051e80e-c10c-4522-a88a-e5da26a74d82` (uso o `owner_user_id` da company). Você poderá reatribuir depois pela tela de aluno.
- Ajustar também `students.assigned_trainer_id` para o mesmo treinador, para o cabeçalho exibir o nome corretamente.

**2. Hardening em `src/pages/admin/StudentDetail.tsx` (evita quebra futura)**
- Criar helper local `safeFormatDate(value, fmt)` que retorna `"—"` quando `value` é `null`/inválido.
- Substituir todas as chamadas `format(parseISO(x), …)` no arquivo por esse helper. Pontos identificados:
  - L841: datas de início/fim da matrícula ativa
  - L848: datas dos ciclos
  - L872: data de nascimento
  - Demais ocorrências (matrículas históricas, pagamentos, avaliações)
- Filtrar `null` em `trainerIds` antes do `.in("user_id", trainerIds)` para não passar lixo ao Supabase.

### Resultado esperado
- A página `/students/23472c23…` carrega sem erro.
- Cabeçalho mostra treinador, datas formatadas corretamente, e a matrícula da Ludmila aparece como ativa com período válido.
- Qualquer outro aluno com dados parciais (ex.: importações futuras) não derruba mais a tela.

