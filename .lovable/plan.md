## Problema

No Prescritor Unificado (`Studio Integrado → Prescrição`), o painel **"Dados para a prescrição"** está mostrando o preenchimento **manual** (o que a equipe editou) em vez das respostas reais do aluno, mesmo quando o aluno já respondeu o questionário. Também há bugs de leitura (ex.: "de 30 a 45 minutos" vira `3045`, e `["Nenhum"]` aparece como modalidade).

### Causa raiz
- Existe **um único** registro por aluno na tabela `anamnesis`. Tanto o **formulário do aluno** (via `public-anamnesis`, que grava o snapshot completo no campo `data`) quanto a **edição manual da equipe** (na ficha do aluno) escrevem nesse mesmo registro — mas a edição manual grava só nas colunas e **nunca** no `data`.
- O prescritor monta a base a partir de `student_anamneses` (cópia manual salva na prescrição) e só sobrepõe com respostas do aluno quando o mapeamento encontra valor. O mapeamento tem lacunas (não cobre `dias cardio/semana`, atleta de endurance) e um parser que quebra em faixas de texto ("30 a 45" → 3045).
- Não há um sinal claro de "o aluno respondeu", então dados manuais antigos acabam prevalecendo.

## Decisões (confirmadas)
- **Aluno vence**: quando o aluno respondeu, as respostas dele são a fonte da verdade; o manual só preenche **campo a campo** o que o aluno deixou em branco.
- **Anamnese manual vira somente-leitura** na ficha do aluno quando o aluno já respondeu (evita sobrescrever).

## O que será feito

### 1. Sinal confiável de "aluno respondeu"
- Considerar que **o aluno respondeu quando `anamnesis.data` é um objeto não-vazio** (só o formulário público grava `data`).
- Ajustar a edge function `public-anamnesis` para carimbar `submitted_at` a cada submissão do aluno, reforçando o sinal.

### 2. Corrigir a leitura no Prescritor (`UnifiedPrescriber.tsx`)
- Inverter a lógica de mescla para: **respostas do aluno (`data`) primeiro** → depois colunas legadas da `anamnesis` → depois `student_anamneses` (manual) apenas para campos ainda vazios → por fim os defaults.
- Corrigir o parser numérico para faixas/textos: "de 30 a 45 minutos" passa a extrair um número válido (usa o maior da faixa), e valores como "Nenhum" não entram como modalidade.
- Completar o mapeamento que hoje falta: `dias cardio/semana`, atleta de endurance, e leitura robusta das colunas legadas (`session_duration`, `available_days`, `modalities`, `goals`, `physical_activity_level`, `training_location`, `injuries`).
- Melhorar o resumo "o aluno respondeu" no topo e exibir um selo claro (ex.: "Puxado da anamnese do aluno" vs "Sem resposta do aluno — usando dados manuais").

### 3. Anamnese manual somente-leitura quando o aluno respondeu (`StudentDetail.tsx`)
- Na sub-aba **Avaliações → Anamnese**, quando `data` do aluno não estiver vazio: desabilitar o botão de editar (ou abrir em modo leitura) com aviso "O aluno já respondeu — edição bloqueada para não sobrescrever".
- Quando o aluno **não** respondeu, a edição manual continua funcionando normalmente (fallback).

## Detalhes técnicos
- `supabase/functions/public-anamnesis/index.ts`: incluir `submitted_at: new Date().toISOString()` no update/insert do `submit`.
- `src/pages/admin/UnifiedPrescriber.tsx`:
  - Reescrever `mapAnsweredAnamnesis` e o bloco de carregamento (efeito do `studentId`) para priorizar `ans` (data + colunas) e usar `sa` só como preenchimento de lacunas.
  - Novo parser `toRangeInt`/ajuste em `toInt` para lidar com "30 a 45", "45min", etc.
  - Adicionar `days_per_week_cardio` e `is_endurance_athlete` ao mapeamento.
  - Filtrar tokens inválidos ("nenhum", "n/a") de modalidades.
- `src/pages/admin/StudentDetail.tsx`: computar `studentAnswered = !!anamnesis?.data && Object.keys(anamnesis.data).length > 0` e usar para travar `openEditAnamnesis`/`handleSaveAnamnesis`.

Nenhuma alteração de schema é necessária (a coluna `submitted_at` já existe). Somente ajuste da edge function e do frontend.
