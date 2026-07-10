## Problema

Ao salvar medidas corporais de um aluno pela área da equipe, o Supabase retorna:

```
new row violates row-level security policy for table "body_measurements"
```

### Causa

A tabela `body_measurements` hoje tem apenas 3 políticas:

- **SELECT** company-scoped (a equipe consegue ler)
- **ALL** só para `master`
- **ALL** só para o próprio aluno (`student.user_id = auth.uid()`)

Não há nenhuma política que permita **admin / coordenador / treinador** inserir, editar ou excluir medidas dos alunos da própria empresa. Como o usuário logado é da equipe (não é master nem o aluno), o `INSERT` é barrado.

As tabelas irmãs (`student_goals`, `student_documents`) já têm o padrão correto — falta replicá-lo aqui.

## Correção

Criar uma migração que adiciona uma política de escrita para a equipe, seguindo exatamente o mesmo padrão de `student_goals`:

```sql
CREATE POLICY "Staff manage company measurements"
ON public.body_measurements
FOR ALL
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinator'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  )
)
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinator'::app_role)
    OR has_role(auth.uid(), 'trainer'::app_role)
  )
);
```

Isso permite que a equipe registre/edite/apague medidas apenas dos alunos da sua própria empresa, mantendo a leitura, o acesso master e o acesso do aluno intactos.

## Verificação

- Confirmar que o `company_id` enviado no insert (`BodyMeasurements.tsx` já envia `company_id`) bate com `get_user_company_id(auth.uid())`.
- Testar salvar medidas pela área da equipe e confirmar que o erro some.
