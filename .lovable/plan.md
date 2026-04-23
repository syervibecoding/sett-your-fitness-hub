

## Bruna não vê a anamnese da Ludmila

### Causa raiz
As 2 anamneses da Ludmila no banco estão com `company_id = NULL`:

```
anamnesis e0e5… → company_id: NULL  (submetida 22/04)
anamnesis 59fc… → company_id: NULL  (submetida 23/04)
```

A RLS de `anamnesis` para usuários autenticados exige:
```sql
company_id = get_user_company_id(auth.uid())
```

`NULL = <uuid>` é **falso**, então a Bruna (admin da empresa `c051e80e…`) não enxerga nenhuma das duas. Você consegue ver porque sua conta tem role `master`, que dá bypass total via policy "Master full access".

A origem do bug está em `src/pages/PublicAnamnesis.tsx` (linhas 121–143): o `payload` enviado pelo formulário público da anamnese **não inclui `company_id`**. Como a rota é anônima e não há trigger no banco para preencher esse campo a partir de `student_id`, ele fica `NULL` para sempre.

### Correções

**1. Backfill dos dados existentes (migração)**
Atualizar todas as anamneses com `company_id IS NULL`, copiando do `students.company_id`:
```sql
UPDATE public.anamnesis a
SET company_id = s.company_id
FROM public.students s
WHERE a.student_id = s.id
  AND a.company_id IS NULL;
```

**2. Trigger no banco para nunca mais acontecer**
Espelhar o padrão já usado em `enrollments` (`set_enrollment_company_id`). Criar `set_anamnesis_company_id()` + trigger `BEFORE INSERT OR UPDATE` que, se `NEW.company_id IS NULL`, busca de `students.company_id` via `student_id`. Garante consistência mesmo se outro fluxo esquecer o campo.

**3. Hardening do frontend (`PublicAnamnesis.tsx`)**
Buscar `company_id` do aluno no início do componente (já carrega o student por `studentId`) e incluir no `payload` do insert/update. Defesa em profundidade: o trigger cobre, mas o cliente também envia explicitamente.

### Resultado esperado
- As duas anamneses já existentes da Ludmila ficam visíveis para a Bruna (e qualquer admin/coordenador/treinador da empresa, conforme RLS).
- Novas submissões públicas de anamnese sempre nascem com `company_id` correto.
- Nenhum impacto em outras empresas — backfill é idempotente e usa o `company_id` do próprio aluno.

### Detalhes técnicos
- Tabelas tocadas: `anamnesis` (UPDATE de backfill + novo trigger).
- Arquivos tocados: `src/pages/PublicAnamnesis.tsx` (inclusão de `company_id` no payload).
- RLS não muda — está correta. O bug é de dado faltando, não de policy.
- Não afeta a policy `"Anon can insert anamnesis"`: o anônimo continua podendo inserir; o trigger preenche o `company_id` antes do INSERT efetivar.

