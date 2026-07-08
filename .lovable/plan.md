## Objetivo

Fazer a tela **Explorar** do app do aluno refletir apenas as modalidades que o treinador escolheu na **Anamnese** do Studio de Prescrição. Cards básicos (Treino, Estatísticas, Calendário, Histórico, Medidas, Avisos, Atividades) continuam sempre visíveis. **Nutrição** e os esportes de **cardio** (Natação, Corrida, Ciclismo) só aparecem quando prescritos — cada esporte com seu próprio card nomeado.

A visibilidade é dirigida pela **seleção salva na anamnese** (não pela existência do plano), então o card aparece assim que o treinador marca a modalidade, mesmo antes de gerar/publicar o plano.

## Etapas

### 1. Banco — salvar as modalidades escolhidas
Adicionar coluna `prescribed_modalities text[]` (default `'{}'`) na tabela `student_anamneses`. Guarda as chaves escolhidas no Studio: `musculacao`, `corrida`, `natacao`, `ciclismo`, `nutricao`.

### 2. Studio de Prescrição (`UnifiedPrescriber.tsx`)
- No `saveAnamnese()`: incluir `prescribed_modalities: [...modalities]` no payload de insert/update.
- Ao carregar a anamnese de um aluno já existente: preencher o estado `modalities` a partir de `prescribed_modalities` salvo (caindo para `["musculacao"]` quando vazio), para o treinador ver o que já foi definido.

### 3. Portal do aluno (`StudentPortal.tsx`)
- Carregar `prescribed_modalities` de `student_anamneses` do aluno logado.
- Passar essa lista para `StudentHome`.
- Ampliar `ActiveView` e a renderização de cardio para aceitar um esporte específico (Natação / Corrida / Ciclismo), passando o filtro de esporte para `CardioPlanView`.

### 4. Home do aluno (`StudentHome.tsx`)
- Receber `prescribedModalities: string[]`.
- Manter fixos: Treino, Estatísticas, Calendário, Histórico, Atividades, Avisos, Medidas.
- Renderizar condicionalmente:
  - **Nutrição** → só se `nutricao` prescrito.
  - **Natação** → só se `natacao` prescrito (card próprio, ícone de ondas).
  - **Corrida** → só se `corrida` prescrito (card próprio).
  - **Ciclismo** → só se `ciclismo` prescrito (card próprio, ícone de bike).
- Remover o card genérico "Cardio", substituído pelos cards por esporte.
- Cada card de esporte navega para a visão de cardio já filtrada por aquele esporte.

### 5. Visão de cardio (`CardioPlanView.tsx`)
- Aceitar prop opcional `sport` para exibir apenas o plano do esporte selecionado quando vindo de um card específico.

## Detalhes técnicos

- **Migração** (via ferramenta de migração):
```sql
ALTER TABLE public.student_anamneses
  ADD COLUMN IF NOT EXISTS prescribed_modalities text[] NOT NULL DEFAULT '{}';
```
Sem novos GRANTs/policies — a tabela já tem RLS e privilégios configurados; apenas nova coluna.

- **Compatibilidade retroativa**: alunos sem `prescribed_modalities` (array vazio) não mostram cards de modalidade. Se preferir, posso fazer um fallback: quando vazio, inferir de planos existentes (`nutrition_plans` / `running_plans.sport`) para não "sumir" modalidades de quem já tem plano. Sigo sem fallback salvo indicação contrária.

- Mapa de esportes usado nos cards: `natacao → "Natação"`, `corrida → "Corrida"`, `ciclismo → "Ciclismo"`.

## Fora de escopo
- Novos motores de IA, tabelas ou mudanças no fluxo de geração/publicação de planos.
- Alterações no BNITO ou em outras telas do aluno.