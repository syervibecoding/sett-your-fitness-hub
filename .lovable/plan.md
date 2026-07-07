## Objetivo

Transformar a tela **Prescrição Integrada** (`/prescricao`, componente `UnifiedPrescriber`) no **Studio de Prescrição** em etapas, seguindo a imagem de referência:

```text
Studio de Prescrição
Anamnese → Avaliação → Prescrições integradas → PDFs

┌─ Aluno ──────────────────────────────────────┐
│ [buscar aluno...............]                 │
│ [ selecione o aluno            ▼ ]            │
│ [   ✈ Enviar anamnese no WhatsApp   ]         │
│ [ ✈ Gerar link de anamnese ] [ ✦ Fazer presc]│
└───────────────────────────────────────────────┘

[ 1. Anamnese ] [ 2. Avaliação ] [ 3. Prescrição ]
┌───────────────────────────────────────────────┐
│  (conteúdo da etapa ativa)                     │
└───────────────────────────────────────────────┘
```

## Etapas do fluxo

**Topo — seleção de aluno (sempre visível)**
- Campo de busca que filtra a lista de alunos por nome.
- Select do aluno (mantém o comportamento atual de carregar dados).
- Botão largura total **"Enviar anamnese no WhatsApp"** → reaproveita `whatsapp-manager` ação `send-anamnesis-invite` (mesma chamada usada no cadastro do aluno), passando `studentIds: [id]` e `baseUrl: window.location.origin`.
- **"Gerar link de anamnese"** → copia `${origin}/anamnese/${studentId}` para a área de transferência (mesmo link que o WhatsApp envia) com toast de confirmação.
- **"Fazer prescrição"** → atalho que pula para a etapa 3.

**Etapa 1 · Anamnese**
- Ao selecionar o aluno, carregar a anamnese respondida pelo aluno (tabela `anamnesis`, a que o link público preenche) e exibir um cartão **"Anamnese respondida pelo aluno"** com resumo: Objetivo, Nível, Modalidade, Dias força/sem, Lesões — ou um estado vazio ("Aguardando resposta do aluno / preencha manualmente").
- Mapear os campos da `anamnesis` para a estrutura usada pela prescrição (`student_anamneses`) — ver seção técnica. Os campos continuam editáveis pelo treinador (as seções de acordeão atuais: Dados pessoais, Treino, Corrida, Saúde).
- Botão "Avançar para Avaliação".

**Etapa 2 · Avaliação (embutida)**
- Extrair o miolo da página `FunctionalAssessment` para um componente reutilizável `FunctionalAssessmentPanel` que recebe `studentId` e `companyId` por prop (hoje ele gerencia a própria seleção de aluno).
- Renderizar esse painel dentro da etapa 2, já amarrado ao aluno selecionado no topo — o treinador faz a avaliação sem sair da tela.
- A página standalone `/avaliacao` passa a usar o mesmo painel com seu próprio seletor (sem regressão).
- Botão "Avançar para Prescrição".

**Etapa 3 · Prescrição**
- Bloco atual "Quais prescrições gerar?" (musculação / corrida) + progresso + resultados + PDFs.
- Mantém a geração via `ai-prescribe-workout` / `ai-running-plan` já existente e usa a avaliação da etapa 2 como contexto.

## Unificação da anamnese (aluno → prescrição)

Hoje há duas tabelas:
- `anamnesis` — preenchida pelo aluno via `/anamnese/:studentId`.
- `student_anamneses` — lida pelas IAs de prescrição.

No carregamento do aluno, buscar a `anamnesis` mais recente e **pré-preencher** os campos de `student_anamneses` a partir dela, mapeando:

| student_anamneses | origem em anamnesis |
|---|---|
| objective | `goals` / `data.objetivo_descricao` |
| activity_level | `physical_activity_level` |
| training_modality | `modalities` (join) |
| session_duration_min | `session_duration` |
| days_per_week_strength / cardio | `training_days` / `available_days` |
| injuries | `injuries` |
| sleep_quality | `sleep_quality` |
| stress_score | `stress_level` |
| sport / cardio_goal | `data` (interesses de endurance) |

Se já existir um registro em `student_anamneses`, ele tem prioridade (não sobrescreve edições do treinador); a anamnese do aluno só preenche o que estiver vazio. Ao gerar, continua salvando em `student_anamneses` como hoje.

## Detalhes técnicos

- **Arquivos alterados**: `src/pages/admin/UnifiedPrescriber.tsx` (reestruturação em wizard com `Tabs`), `src/pages/admin/FunctionalAssessment.tsx` (extrair painel).
- **Arquivo novo**: `src/components/admin/FunctionalAssessmentPanel.tsx` — recebe `studentId`/`companyId`, contém a lógica de upload/laudo/PDF hoje na página.
- **Sem mudanças de banco**: reaproveita tabelas, edge functions (`whatsapp-manager`, `ai-prescribe-workout`, `ai-running-plan`, `public-anamnesis`) e o link público existentes.
- Navegação por etapas com o componente `Tabs` do shadcn; estado da etapa ativa local. Busca de aluno com filtro em memória sobre a lista já carregada.
- Cabeçalho com o nome do assistente/branding da empresa (como o "BN" da imagem) usando o hook `useAssistantName` já existente.

## Fora de escopo

- Não altero a publicação de musculação no portal do aluno (tema anterior sobre `ai_strength_plans` → `training_cycles`) — fica para uma decisão separada.
- Sem novos modelos de IA ou tabelas.