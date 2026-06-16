# Worksheet de Curadoria — Regiões de Risco: Joelho / Lombar / Ombro (v1)

> **Pacote de curadoria (ORDEM 026). NADA aplicado no banco.** Tudo é **sugestão** (`reviewer_status =
> needs_review`) e exige **validação humana** (professor/curador). Planilha:
> `library-curation-risk-regions-v1.csv` (205 linhas).

## 1. Objetivo
Preparar metadados **sugeridos** (pain tags, contraindications, regressões, substitutos, equipment) para
**todos os exercícios relevantes** às três regiões de risco da auditoria — joelho, lombar e ombro — para
que o engine possa restringir/substituir com segurança e derrubar `BLOCKED_FOR_SHADOW`. Sem aplicar nada.

## 2. Critério de identificação por região
Mesmos filtros da auditoria (ORDEM 021), por nome e/ou `muscle_group`:
- **joelho:** nome ~ agachamento/leg press/hack/afundo/extensora/step up OU grupo `quadr`.
- **lombar:** nome ~ lombar/terra/good morning/RDL/romeno/stiff/hip thrust/posterior OU grupo `posterior|lombar|glúteo`.
- **ombro:** nome ~ ombro/desenvolvimento/overhead/supino/dips/remada alta/barra nuca OU grupo `ombro|peit`.
- Exercício que cai em 2 regiões aparece em **2 linhas** (coluna `risk_region` deixa claro) — ex.:
  "Agachamento com Desenvolvimento Halteres" (joelho + ombro).

## 3. Resumo quantitativo
| Métrica | Valor |
|---|---|
| Relevantes a **joelho** | **54** |
| Relevantes a **lombar** | **51** |
| Relevantes a **ombro** | **100** |
| Total de linhas (com multi-região) | **205** |
| Exercícios únicos (ids distintos) | **203** (2 em duas regiões) |
| **P1** (alto risco) | **51** |
| **P2** (composto moderado) | **80** |
| **P3** (isolado/acessório/opção segura) | **74** |
| Linhas com substituto real sugerido | **205 (100%)** |
| `reviewer_status = needs_review` | **205 (100%)** |

(Bate com a auditoria: 54/51/100.)

## 4. Principais riscos encontrados
- **Joelho:** agachamentos livres/profundos, sumô landmine/belt, afundos/búlgaros/passadas (carga + valgo/equilíbrio).
- **Lombar:** levantamento terra (todas as variações), stiff, RDL, good morning/"bom dia", rack pulls — carga axial e flexão espinhal.
- **Ombro:** desenvolvimentos (Arnold/militar/barra/máquina/landmine), overhead, remada alta, encolhimento overhead, dips — pressão overhead e impacto/escapular.
- **Comum às três:** **0** cobertura de pain tags/contraindications/substitutos hoje (metadata vazia).

## 5. Exemplos de curadoria por região
- **Joelho (P1)** — *Agachamento Livre* → pain `knee_pain; dynamic_valgus; deep_loaded_knee_flexion`, contra
  `acute_knee_pain; deep_loaded_knee_flexion`; substitutos `Leg Press 45; Leg Press Horizontal; Cadeira Extensora`.
- **Lombar (P1)** — *Levantamento Terra* → pain `low_back_pain; loaded_spinal_flexion; butt_wink; trunk_lean; axial_load`,
  contra `acute_low_back_pain; loaded_spinal_flexion; high_axial_load`; substitutos `RDL Halteres; Elevação Pélvica Máquina; Mesa Flexora`;
  regressões corretivas `Perdigueiro Alternado; Prancha Frontal; Extensão de Quadril Banco Romano`.
- **Ombro (P1)** — *Desenvolvimento Militar* → pain `shoulder_pain; shoulder_impingement; overhead_limitation; painful_pressing_rom; cervical_pain`,
  contra `acute_shoulder_pain; painful_overhead_press; shoulder_impingement; overhead_limitation`;
  substitutos (padrão empurrar_vertical) `Desenvolvimento Máquina; Desenvolvimento Neutro Máquina; Desenvolvimento Unilateral Landmine`.

## 6. Como reduz blockers e `safe_alternative_unavailable`
Com pain tags/contraindications nos exercícios de risco, o engine **bana** com precisão por metadado (não só
por keyword) quando há dor/restrição — e, com substitutos reais por padrão, **sempre acha alternativa segura**
→ derruba `safe_alternative_unavailable` e o gatilho "alto risco sem contraindications" do `audit.sql` (bloco 7),
tornando o shadow uma comparação justa.

## 7. Como revisar humanamente
- Abrir o CSV; revisar por `priority` (P1 primeiro).
- Conferir: as pain tags/contraindications batem com o exercício? os substitutos são mais seguros e existem?
  o `equipment` está certo?
- Editar a sugestão e marcar `reviewer_status` = `approved` / `edited` / `rejected`.
- **IA não decide clinicamente sozinha** — profissional valida antes de qualquer aplicação.

## 8. Nada foi aplicado no banco
Confirmado: somente `SELECT` read-only (via conector) para obter ids/nomes reais; CSV/MD gerados localmente.
**Sem** INSERT/UPDATE/DELETE, migration, ou alteração de engine/edge/UI. Todas as linhas `needs_review`.
Substitutos/regressões usam **apenas exercícios reais** confirmados na biblioteca.

## 9. Próximo passo recomendado
1. Curador valida/edita o CSV (P1 → P2 → P3).
2. Aplicar **só o aprovado** via upsert em `exercise_metadata` (+ `equipment` em `exercise_library`) — **ordem
   futura, com backup/plano**, não fake.
3. Rodar `audit.sql` (bloco 7) antes/depois — meta: `high_risk_without_contraindications = 0` e regiões com
   cobertura mínima de pain tags.
4. Combinar com os pacotes ORDEM 024 (alto risco) e ORDEM 025 (mínimo seguro por padrão) para zerar os dois
   gatilhos de `BLOCKED_FOR_SHADOW`.
