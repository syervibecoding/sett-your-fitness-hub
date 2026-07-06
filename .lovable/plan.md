# Plano — Biblioteca de exercícios + nova anamnese BN

## Parte 1 — Biblioteca de exercícios (CSV → global)

O CSV tem **910 exercícios únicos** com Nome, Grupo muscular, Categoria, Equipamento e vídeo do YouTube. Importar como **globais** (compartilhados entre empresas), inserindo os novos e atualizando os já existentes (dedup por nome).

### 1.1 Migração de schema
- Adicionar coluna `category text` em `public.exercise_library` (hoje não existe). Sem novos GRANTs — a tabela já está liberada.

### 1.2 Importação dos dados (operação de dados, não migração)
Gerar o SQL a partir do CSV e rodar via ferramenta de inserção:
- **Inserir** exercícios cujo nome (case-insensitive) ainda não existe entre os globais: `is_global = true`, `company_id = null`, `difficulty = 'intermediate'`, `muscle_group` = Grupo muscular, `category` = Categoria, `equipment` = Equipamento, `video_url` = link, `thumbnail_url` = `https://img.youtube.com/vi/{YouTubeID}/hqdefault.jpg`.
- **Atualizar** os globais já existentes com o mesmo nome: refrescar `video_url`, `muscle_group`, `category`, `equipment` e `thumbnail_url` a partir do CSV.

### 1.3 UI — `src/pages/admin/ExerciseLibrary.tsx`
- Adicionar estado `filterCategory` e um `Select` de categorias (musculação, core, fisioterapia, performance, mobilidade, etc., derivadas dos dados) ao lado do filtro de grupo muscular já existente.
- Aplicar `filterCategory` na lista `filtered` (junto de `filterGroup` e busca).
- Exibir a categoria como badge/legenda no card do exercício.
- Incluir `category` no formulário de criação/edição de exercício.

## Parte 2 — Nova anamnese BN (substituição completa)

O Google Form BN tem **~60 perguntas em 7 seções**. Hoje a anamnese pública é **fixa no código** (`PublicAnamnesis.tsx`) com ~22 campos. Vou substituir pelo formulário completo. Os campos que já existem como colunas serão reaproveitados; os **novos campos vão para a coluna `data` (JSONB)** que já existe em `anamnesis` — evitando dezenas de colunas novas.

### Seções do novo formulário
1. **Seus dados** — nome (já vem do contexto), idade, sexo, peso, altura, % gordura
2. **Objetivo** — objetivos (múltipla), objetivo principal, descrição livre, interesses (musculação/corrida/natação/ciclismo/nutrição), tem nutricionista, quer dicas de nutrição, já tem assessoria
3. **Rotina de treino** — nível de atividade, tempo de treino (meses), dias/semana, dias por modalidade, minutos/sessão, onde treina, histórico + **subseção endurance** (objetivo/prova, data da prova, volume, recuperação, FC máx/repouso, corrida, natação, ciclismo)
4. **Saúde** — lesões, condições médicas, medicamentos, estresse (0–10), qualidade do sono (0–10), horas de sono
5. **Triagem clínica** — cardíaco/pressão, dor no peito/tontura, cirurgia recente, gestação/pós-parto, fuma, doente agora, **escalas de dor articular** (tornozelo, joelho, quadril, lombar, ombro), outras condições
6. **Rotina alimentar e treino** — refeições/dia, horários, treina em jejum, fome ao acordar
7. **Preferências & substituições** — alimentos que gosta/não gosta, restrições/alergias, orçamento, suplementos, acesso a cozinha, observações

### 2.1 `src/pages/PublicAnamnesis.tsx`
- Reescrever o formulário com as 7 seções acima (mantendo o visual/tema atual: Card, RadioGroup, Checkbox, escalas 0–10 via Slider/radios).
- Campos existentes continuam mapeados às colunas atuais; todos os novos são agrupados num objeto `data` enviado ao edge.
- Seções de endurance/natação/ciclismo ficam visíveis condicionalmente conforme os interesses marcados.

### 2.2 Edge `supabase/functions/public-anamnesis/index.ts`
- Manter `ALLOWED_FIELDS` para as colunas existentes e **aceitar `data` (objeto)**, gravando/mesclando em `anamnesis.data`.

### 2.3 `src/pages/admin/StudentDetail.tsx`
- Exibir os novos campos (lendo de `anamnesis.data`) numa aba/seção de anamnese, organizados pelas 7 seções, para treinador/admin consultarem.
- Ajustar o diálogo de edição para os principais campos novos (os demais em modo leitura, para não inchar a UI).

## Detalhes técnicos
- Sem alteração em RLS. `exercise_library` e `anamnesis` já possuem policies e grants.
- `anamnesis.data` já é `jsonb default '{}'` — nenhuma migração necessária para os campos novos da anamnese.
- Única migração de schema: `ALTER TABLE public.exercise_library ADD COLUMN category text;`
- Import de exercícios roda como operação de dados (INSERT/UPDATE com dedup por `lower(name)` entre globais), gerado a partir do CSV.
- `thumbnail_url` derivada do YouTube ID para pré-visualização rápida no mobile.

## Fora de escopo
- Não altero o gerenciador dinâmico `form_fields` (a anamnese pública é hardcoded; a fonte da verdade continua o `PublicAnamnesis.tsx`).
- Não removo os 447 exercícios globais atuais — apenas insiro novos e atualizo os coincidentes.
