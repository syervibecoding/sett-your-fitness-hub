# Plano de Aplicação Seguro da Curadoria da Biblioteca (v1)

> **ORDEM 028. NADA foi aplicado no banco.** Este documento + o SQL template
> (`library-curation-v1-upsert-template.sql`) apenas **preparam** o caminho. Nenhuma linha foi
> inserida/atualizada; nenhuma flag/deploy/cutover foi feito. Todo o manifesto consolidado segue
> **100% `needs_review`**.

## 1. Resumo executivo
- **A biblioteca tem exercícios suficientes.** A auditoria (ORDEM 021) encontrou **447** exercícios,
  com `muscle_group` 100% e `difficulty` 100% — há massa crítica para todos os padrões de movimento.
- **O bloqueio atual é falta de metadata.** `exercise_metadata` está **vazia (0 linhas)** → 0
  contraindications, 0 pain tags, 0 substitutes, 0 regressions/progressions, e `equipment` 100% ausente.
  Isso dispara `safe_alternative_unavailable`, "alto risco sem contraindications" e o veredito
  **`BLOCKED_FOR_SHADOW`**.
- **O manifesto consolidado** (`library-curation-v1-consolidated-manifest.csv`, **215** exercícios)
  reúne as 3 worksheets, mas está **100% `needs_review`** — são **sugestões**, não decisões.
- **Nada pode ser aplicado até revisão humana.** IA não decide clinicamente sozinha. Só linhas
  `approved` por um profissional podem entrar em upsert futuro.
- **Objetivo desta ordem:** preparar um caminho **seguro, reversível e auditável** para o upsert futuro
  — fluxo de aprovação, lotes, mapeamento de schema, regras de segurança, backup, validação, template
  SQL protegido e reauditoria — sem tocar no banco.

## 2. Fluxo de aprovação
Estados de cada linha do manifesto (controlados na worksheet de revisão, **não** na tabela):

| Estado | Significado | Pode entrar no upsert? |
|---|---|---|
| `needs_review` | Sugestão da curadoria, ainda não revisada | **Não** |
| `approved` | Profissional validou (tags/contra/substitutos corretos e seguros) | **Sim** |
| `rejected` | Profissional descartou | **Nunca** |
| `needs_more_info` | Falta dado/decisão → volta para curadoria | Não (retorna ao fluxo) |
| `applied` | Já aplicado em produção via execução controlada + reauditoria OK | — (registro pós-aplicação) |

**Regras:**
- Somente `approved` entra no upsert.
- `rejected` nunca entra.
- `needs_more_info` volta para curadoria até virar `approved`/`rejected`.
- `applied` só é marcado **depois** de execução controlada (staging → prod) e **reauditoria** passar.

## 3. Ordem de aplicação por lotes
Aplicar de forma incremental, reauditando entre lotes. Prioridade = `max_priority` do manifesto.

- **Lote A — P1 alto risco (51 linhas P1):** desenvolvimentos/overhead; levantamento terra/hinge com
  carga; carga axial/flexão lombar; joelho profundo/carregado; exercícios com **múltiplas
  `risk_regions`** (16 linhas multi-região). *Meta: zerar "alto risco sem contraindications".*
- **Lote B — padrões essenciais (≥3 alternativas seguras por padrão):** `joelho_dominante`,
  `quadril_dominante`, `empurrar_horizontal`, `empurrar_vertical`, `puxar_horizontal`,
  `puxar_vertical`, `core`, `unilateral`, `isolado_acessorio` (fonte: pacote movement-pattern, 27
  candidatos). *Meta: zerar `safe_alternative_unavailable` por padrão.*
- **Lote C — joelho/lombar/ombro:** completar `pain_limitation_tags` + `contraindications` por região
  (fonte: pacote risk-regions, 203 ids; cobertura atual joelho 54 / lombar 51 / ombro 100).
- **Lote D — equipment:** preencher `exercise_library.equipment` o suficiente para
  academia/halteres/casa/máquina/cabo/peso corporal. **Atenção (ver §4):** `equipment` vive em
  `exercise_library` (campo `text` único), **não** em `exercise_metadata` e **não** é array.
- **Lote E — progressions/regressions globais:** completar progressões/regressões nas demais linhas
  aprovadas.

## 4. Campos-alvo em `exercise_metadata` (schema real confirmado)
Schema confirmado via `information_schema` (somente leitura) + migration
`20260614002903_add_ai_decision_logs_and_exercise_metadata.sql`:

| Coluna real | Tipo | Coluna do manifesto | Observação |
|---|---|---|---|
| `exercise_id` | `uuid` (PK, FK→`exercise_library.id`) | `exercise_id` | chave de upsert |
| `contraindications` | `text[]` | `suggested_contraindications` | split por `; ` |
| `pain_limitation_tags` | `text[]` | `suggested_pain_limitation_tags` | split por `; ` |
| `regressions` | `text[]` | `suggested_regressions` | **texto livre** (não FK) |
| `progressions` | `text[]` | `suggested_progressions` | **texto livre** (não FK) |
| `equivalent_substitutes` | **`uuid[]`** | `suggested_equivalent_substitutes` | ⚠️ **nomes → ids**: o manifesto guarda **nomes**; o upsert precisa **resolver cada nome para o `uuid` real** da `exercise_library`. Nome que não resolver = **bloqueia** a linha. |
| `notes` | `text` | `reviewer_notes` (+ `conflict_notes`) | observações do revisor |
| `created_at`/`updated_at` | `timestamptz` | — | gerenciados por trigger |

**SCHEMA_GAP (campos do manifesto SEM coluna correspondente — não inventar coluna):**
- **`equipment` → `SCHEMA_GAP` parcial / tabela diferente.** Não existe em `exercise_metadata`. Existe
  em **`exercise_library.equipment`** como `text` **único** (não array, hoje 100% NULL). Decisão futura:
  Lote D é um `UPDATE public.exercise_library SET equipment = ...` separado, com **um valor** por
  exercício (ou decidir migrar para array/tabela própria — **não** nesta ordem).
- **`movement_patterns` → `SCHEMA_GAP`.** Nenhuma coluna em `exercise_metadata` nem `exercise_library`.
  Hoje é só **insumo de curadoria** (escolha de alternativas por padrão). Decisão futura: criar coluna/
  tabela de taxonomia de padrão, **ou** manter apenas como metadado de curadoria. **Não inventar agora.**
- **`risk_regions` → `SCHEMA_GAP` (indireto).** Sem coluna própria; é codificado **dentro** de
  `pain_limitation_tags` (ex.: `knee_pain`, `low_back_pain`, `shoulder_pain`). Mantém-se como insumo
  de curadoria; não persistir como coluna separada.
- **`max_priority`, `source_packages`, `conflict_notes`, `reviewer_status` → sem coluna.** São
  bookkeeping de curadoria; só `reviewer_notes`/`conflict_notes` podem ir para `notes`. Os demais ficam
  na worksheet, não no banco.

## 5. Regras de segurança para aplicar metadata
Obrigatórias antes/durante o upsert:
- **Não remover tag conservadora** sem justificativa humana registrada em `notes`.
- Exercício **overhead carregado** precisa de `shoulder`/`overhead` caution.
- **Carga axial / hinge carregado** precisa de `low_back` caution.
- **Joelho profundo/carregado** precisa de `knee` caution.
- **Pliometria** precisa de `high_skill`/`impact` caution.
- Todo **P1** precisa de pelo menos uma `contraindication`.
- Todo **substituto/regressão/progressão** referenciando exercício precisa **existir na
  `exercise_library`** (substitutos: resolver para `uuid`; nome não resolvido = bloqueia a linha).
- `equivalent_substitutes` deve **preservar o padrão de movimento ou o músculo-alvo** sempre que possível.
- Se o substituto for de **padrão diferente**, exige `reviewer_notes` justificando (vai para `notes`).

## 6. Backup antes de aplicar (processo futuro — não executar agora)
Antes de **qualquer** upsert real:
1. **Exportar `exercise_metadata` atual** (snapshot completo) — ex.: `CREATE TABLE
   backup_exercise_metadata_<timestamp> AS SELECT * FROM public.exercise_metadata;` **+** dump CSV.
2. **Exportar as linhas-alvo por `exercise_id`** (antes/depois) para diff.
3. **Salvar timestamp** da operação (UTC) e **reviewer/aprovador** responsável.
4. **Salvar o arquivo `manifest approved`** exato usado (hash + caminho versionado no git).
5. **Manter rollback possível** (tabela de backup + script de restore — ver §SQL template).

> Esta ordem **apenas documenta**. Nenhum backup/CREATE foi executado.

## 7. Validação antes do upsert (checklist)
- [ ] Todas as linhas a aplicar estão `approved` (nenhuma `needs_review`/`needs_more_info`).
- [ ] Todos os `exercise_id` existem na `exercise_library`.
- [ ] Todos os `equivalent_substitutes` **resolvem** para `uuid` real (0 nomes não resolvidos).
- [ ] Todos os `regressions`/`progressions` que citam exercício existem na biblioteca.
- [ ] Nenhum campo contém exercício inventado (as 5 sugestões não-reais já estão fora — ver manifesto §5).
- [ ] Arrays no formato esperado (`text[]` / `uuid[]`), sem strings vazias.
- [ ] Sem duplicatas por `exercise_id`.
- [ ] Todos os **P1** revisados por humano e com `contraindication`.
- [ ] Schema confere com o template (colunas reais da §4).
- [ ] SQL roda em **staging primeiro**, com `ROLLBACK`, antes de qualquer `COMMIT` em produção.

## 8. Template de upsert
O arquivo **`library-curation-v1-upsert-template.sql`** é **apenas template** — **não executável sem
edição consciente**. Ele contém:
- Banner `-- TEMPLATE ONLY` / `-- DO NOT RUN WITHOUT HUMAN REVIEW` / `-- REPLACE VALUES FROM APPROVED MANIFEST ONLY`.
- **CTE `approved_manifest`** de exemplo, **vazia/comentada** (nenhum dado real ativo).
- Exemplo de **estrutura de uma linha** comentada (com `substitute_names` em texto, a serem resolvidos para `uuid`).
- **Bloco de upsert** em `exercise_metadata` usando **colunas reais** (com resolução nome→`uuid` dos substitutos).
- Comentários de **onde inserir** os valores aprovados.
- **`SELECT` de validação** antes do upsert.
- **`SELECT` de reauditoria** depois do upsert.
- **Rollback plan** em comentário.
- Proteções para **não rodar acidentalmente** (guarda `RAISE EXCEPTION` + CTE vazia + `BEGIN/ROLLBACK`).

Não há dados reais aprovados nesta ordem → **nenhum** valor real ativo no SQL.

## 9. Reauditoria depois de aplicar (futuro)
Após cada lote aplicado, rodar:
`docs/prescription/bn-prescription-engine-v1-library-metadata-audit.sql`

Métricas esperadas:
- `exercise_metadata` **> 0** linhas.
- `high_risk_without_contraindications` **= 0**.
- Padrões essenciais com **≥3** alternativas seguras.
- Coverage joelho/lombar/ombro com `pain_limitation_tags` mínimas.
- `safe_alternative_unavailable` esperado **menor** em amostra.
- `status_sugerido` melhora de **`BLOCKED_FOR_SHADOW`** → **`ACCEPT_WITH_NOTES`** ou **`ACCEPT`**.

## 10. Critério para liberar **shadow diagnóstico**
Mínimo:
- **Lote A** aprovado/aplicado.
- **≥3** alternativas seguras por padrão essencial.
- Joelho/lombar/ombro com pain tags mínimas.
- **Deno check** da edge passa.
- **Flag default segue `off`.**
- Shadow **autorizado explicitamente** pelo orquestrador.

## 11. Critério para liberar **shadow de paridade**
Mais forte:
- **Lotes A+B+C** aplicados.
- `equipment` razoável (Lote D).
- Substitutes/regressions nos **compostos principais**.
- Auditoria **sem `BLOCKED_FOR_SHADOW`**.
- Amostra real **sem taxa alta de blockers artificiais**.
- **Codex** (ou revisão independente) aprova.

## 12. Critério para liberar **cutover**
- **Fora do escopo** deste plano.
- Requer **ordem explícita**.
- Requer **shadow real aprovado**.
- Requer **rollback testado**.
- Requer **PDF/portal OK** (contrato de saída intacto).
- Requer **deploy autorizado**.
- **Flag ON continua proibida** até ordem explícita.

## 13. Não fazer
- Não aplicar linhas `needs_review`.
- Não rodar upsert em produção sem aprovação.
- Não usar IA para decidir clinicamente sozinha.
- Não apagar metadados existentes sem backup.
- Não remover blockers do engine para "compensar" biblioteca ruim.
- Não ligar shadow/cutover por causa **deste** plano.

## 14. Próxima etapa recomendada
Criar uma worksheet de aprovação humana:
**`docs/prescription/library-curation-v1-review-board.md`** — onde o profissional marca cada
`exercise_id` como `approved`/`rejected`/`needs_more_info`, com responsável e data.

> **Não criar agora** (salvo pedido explícito do orquestrador).

---

### Confirmação de não-alteração (ORDEM 028)
- Precondição **atendida**: `library-curation-v1-consolidated-manifest.csv` **existe** (215 linhas).
- Apenas **`SELECT` read-only** (`information_schema`) + leitura de migration foram usados para confirmar schema.
- **Sem** INSERT/UPDATE/DELETE/ALTER/CREATE, migration, alteração de engine/edge/UI, deploy ou flag.
- O template SQL é **seguro por padrão** e não foi executado.
