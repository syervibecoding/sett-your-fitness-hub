# Onda 3 — Atividades externas + Mural de comunicação

Escopo confirmado: itens #1 e #2. Integração Strava fica fora (avaliamos depois).

---

## 1. Atividades externas manuais

Aluno registra atividades fora da musculação (corrida, natação, bike, caminhada, yoga, etc). Aparecem no calendário, contam para a meta semanal e ficam visíveis ao treinador.

### Banco
Nova tabela `external_activities`:
- `student_id`, `company_id`
- `activity_type` (text: 'corrida','natacao','bike','caminhada','yoga','outro')
- `activity_date` (date)
- `duration_minutes` (int, opcional)
- `distance_km` (numeric, opcional)
- `intensity` (smallint 1-5, opcional)
- `notes` (text)
- `created_at`

RLS: aluno lê/insere/edita/apaga as próprias; equipe da empresa lê tudo da empresa; master full access.

### Frontend
- **Novo:** `src/components/student/ExternalActivityForm.tsx` — modal com tipo (chips), data, duração, distância (só se aplicável), intensidade, notas.
- **Novo:** `src/components/student/ExternalActivitiesList.tsx` — lista no `StudentHome` com editar/apagar.
- **Editar:** `StudentCalendar.tsx` — marcar dias com atividade externa com ícone/cor distinta da musculação (badge dupla quando tem os dois).
- **Editar:** `WeeklyBar.tsx` — a meta semanal passa a contar musculação + externas (somatório). Toggle visual para diferenciar.
- **Editar:** `StudentHome.tsx` — botão "Registrar atividade externa".
- **Editar:** `src/components/admin/StudentFeedbackTab.tsx` ou novo tab "Atividades" em `StudentDetail.tsx` — treinador vê as externas cronologicamente.

---

## 2. Mural de comunicação

Admin/coordenador publica posts; todos os alunos da empresa veem no portal.

### Banco
Nova tabela `announcements`:
- `company_id`, `author_id` (uuid → auth.users)
- `title` (text)
- `body` (text)
- `image_url` (text, opcional)
- `pinned` (boolean default false)
- `published_at` (timestamptz default now)
- `created_at`, `updated_at`

Nova tabela `announcement_reads` (para badge "novo"):
- `announcement_id`, `student_id`, `read_at`
- UNIQUE(announcement_id, student_id)

RLS:
- `announcements`: equipe da empresa (admin/coordenador) cria/edita/apaga; alunos da empresa só leem.
- `announcement_reads`: aluno gerencia os próprios reads.

Bucket de storage: reutilizar `platform-assets` com prefixo `announcements/{company_id}/`.

### Frontend — Admin
- **Novo:** `src/pages/admin/Announcements.tsx` — lista + criar/editar/apagar + fixar.
- **Novo:** `src/components/admin/AnnouncementEditor.tsx` — form com título, corpo (textarea), upload de imagem opcional, toggle fixar.
- **Editar:** menu lateral admin — adicionar item "Mural".

### Frontend — Aluno
- **Novo:** `src/components/student/AnnouncementsFeed.tsx` — feed cronológico (fixados no topo), badge "novo" para não lidos, marca como lido ao expandir.
- **Editar:** `StudentPortal.tsx` — adicionar tab/seção "Avisos" com contador de não lidos.

---

## Tier gating
Atividades externas: liberado para todos os tiers (sem custo de infra).
Mural: liberado para todos os tiers.

---

## Ordem de execução
1. Migration (2 tabelas + 1 tabela auxiliar + RLS)
2. Atividades externas (form, lista, integração com calendário/weekly bar, tab admin)
3. Mural (página admin + editor, feed aluno)

## Detalhes técnicos
- Activity type guardado como text livre validado no front (sem enum no DB para facilitar adicionar novos depois).
- Distance só editável quando type ∈ {corrida, bike, caminhada, natacao}.
- Weekly goal counter passa de `count(workout_sessions where status='completed' this week)` para `count(distinct date) onde houve workout OU external_activity`.
- Mural sem comentários/likes nesta fase (foi descartado pela Bruna como "não usaria").
- Reads tracking via upsert client-side ao abrir o post.
