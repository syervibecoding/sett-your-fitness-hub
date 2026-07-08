## Objetivo

Reorganizar a página de detalhe do aluno (`src/pages/admin/StudentDetail.tsx`) das **8 abas planas** atuais para a **nova divisão em 3 grupos com subabas**, conforme as imagens. Nenhuma mudança de banco: apenas reestruturação da navegação e reaproveitamento dos blocos já existentes. Os blocos ainda inexistentes entram como placeholders "em breve".

## Nova estrutura de abas

```text
[ Programa ]   [ Avaliações ]   [ Visão 360 ]
     |               |                |
 Programa        Anamnese        Visão Geral
 Treinos         Avaliações      Financeiro
 Análises        Progresso       Acompanhamento
```

### Programa (aba principal)
- **Programa** → bloco *Provas e Metas* (placeholder "em breve") + o conteúdo atual de MATRÍCULAS (aba `program` de hoje).
- **Treinos** → conteúdo atual da aba `workouts` (ciclos, Editar Treinos, radar por treino).
- **Análises** → conteúdo atual da aba `analytics` (`TrainerWeeklyBar` + `WorkoutAnalysis`).

### Avaliações (aba principal)
- **Anamnese** → conteúdo atual da aba `anamnesis`.
- **Avaliações** → conteúdo atual da aba `evaluations`.
- **Progresso** → reaproveita `BodyMeasurements` (medidas + avatar) e `MuscleRadar` já existentes, mais o `BodyLimitationsEditor` (a aba "Limitações" atual é dobrada aqui, já que some da barra principal).

### Visão 360 (aba principal)
- **Visão Geral** → bloco *Acesso do App* (área do botão "Ativar Acesso" já existente) + conteúdo atual da aba `overview` (MATRÍCULA ATIVA).
- **Financeiro** → conteúdo atual da aba `financial`.
- **Acompanhamento** → placeholders "em breve": *Contato semanal*, *Linha do Tempo* e *Pasta do Aluno*.

## Implementação (frontend apenas)

- Trocar o `<Tabs>` único por **Tabs aninhadas**: 3 `TabsTrigger` principais (`programa`, `avaliacoes`, `visao360`) e, dentro de cada `TabsContent`, um novo `<Tabs>` com as subabas.
- Mover os `TabsContent` existentes (overview, program, workouts, analytics, anamnesis, limitations, financial, evaluations) para dentro dos grupos, sem alterar o conteúdo/lógica de cada um.
- Progresso: renderizar `BodyMeasurements` (recebe `studentId`, `companyId`, `gender` — já disponíveis na página) + `MuscleRadar` + `BodyLimitationsEditor`.
- Placeholders: um componente simples de card "Em breve" reutilizado para Provas e Metas, Contato semanal, Linha do Tempo e Pasta do Aluno, para a estrutura já refletir as imagens.
- Ajustar `defaultValue` para abrir em **Programa** (ou Visão Geral, se preferir) e garantir que as subabas tenham `defaultValue` próprio.
- Barra de subabas com o mesmo estilo visual das imagens (subabas menores, abaixo das principais).

## Detalhes técnicos

- Arquivo único afetado: `src/pages/admin/StudentDetail.tsx`.
- Sem migrações, sem edge functions, sem mudanças de RLS.
- Os componentes reaproveitados já recebem `studentId`/`companyId` e respeitam as policies atuais (admin/treinador já lê medidas e limitações do aluno nas abas existentes).

## Fora de escopo (fica como placeholder "em breve")

- Provas e Metas (datas-alvo), Linha do Tempo (histórico automático), Pasta do Aluno (upload de arquivos) e Contato semanal (toggle do assistente) — serão construídos depois, com as tabelas/storage necessários, num próximo passo.