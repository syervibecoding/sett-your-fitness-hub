# Worksheet — Mínimo Seguro por Padrão de Movimento (v1)

> **Pacote de curadoria (ORDEM 025). NADA foi aplicado no banco.** Tudo é **sugestão**
> (`reviewer_status = needs_review`) e exige **validação humana** (professor/curador).
> Planilha: `library-curation-movement-pattern-minimum-safe-v1.csv`.

## 1. Objetivo
A auditoria (ORDEM 021) mostrou **0 exercícios "seguros" por padrão** (porque `exercise_metadata` está
vazia), o que dispara o blocker `safe_alternative_unavailable` e o `BLOCKED_FOR_SHADOW`. Este pacote
propõe **≥3 candidatos reais e seguros por padrão essencial/de movimento** com metadados **sugeridos**,
para que cada padrão tenha alternativa segura quando o engine precisar substituir por dor/restrição.

## 2. Critério de seleção
- Apenas `exercise_id`/`exercise_name` **reais** (buscados via `SELECT`); **nenhum inventado**.
- Preferência por variações **estáveis e regredíveis**: máquina, apoiado, pegada neutra, assistido
  (ex.: leg press/extensora, mesa flexora, supino máquina/voador, remada apoiada, graviton, prancha).
- Tags **conservadoras** (na dúvida, marcar cautela) seguindo a taxonomia do plano de curadoria.
- 3 candidatos por padrão (mínimo). Se não houvesse 3 reais → `BLOCKED_PATTERN` (não ocorreu).

## 3. Resumo por padrão
| Padrão | Candidatos (3/3?) | Riscos principais | Observação de revisão |
|---|---|---|---|
| **joelho_dominante** | Leg Press 45, Cadeira Extensora, Leg Press Horizontal — **3/3** | joelho (patelofemoral), valgo | extensora = cadeia aberta (monitorar patela); leg press = controlar valgo/ROM |
| **quadril_dominante** | Mesa Flexora, Cadeira Flexora, Elevação Pélvica Máquina — **3/3** | lombar (mínimo; hip thrust apoiado) | baixa carga axial; validar low_back tag no hip thrust |
| **empurrar_horizontal** | Supino Reto Máquina, Supino Inclinado Máquina, Voador — **3/3** | ombro/impacto | guiado/peck = controle escapular, ROM indolor |
| **empurrar_vertical** | Desenvolvimento Máquina, Desenvolvimento Neutro Máquina, Desenvolvimento Unilateral Landmine — **3/3** | ombro/overhead | máquina/landmine = overhead mais seguro que livre |
| **puxar_horizontal** | Remada Baixa Neutra, Remada Cavalinho Máquina Neutra, Remada Polia Média Corda — **3/3** | ombro; lombar (remada baixa) | preferir apoiada no peito p/ poupar lombar |
| **puxar_vertical** | Puxada Neutra Polia, Pulldown barra, Graviton Neutro — **3/3** | ombro/cervical | pegada neutra; evitar atrás da nuca; graviton = regressão assistida |
| **core** | Prancha Frontal, Prancha Lateral, Perdigueiro Alternado — **3/3** | baixo | **anti-extensão/anti-flexão-lateral/anti-rotação** priorizados |
| **unilateral** | Afundo Halteres, Agachamento Búlgaro com Apoio, Step Up Halteres — **3/3** | joelho/valgo; equilíbrio | iniciar com apoio; regredir por altura/carga |
| **isolado_acessorio** | Elevação Lateral Halteres, Rosca Direta Halteres, Tríceps Polia Corda — **3/3** | baixo (ombro/punho) | bom papel de substituição/acessório |

**Total de candidatos listados: 27** (9 padrões × 3).

## 4. Padrões bloqueados
**Nenhum.** Todos os 9 padrões atingiram **3/3** com candidatos reais e seguros na biblioteca.

## 5. Como reduz `safe_alternative_unavailable`
Quando o engine precisa substituir um exercício (dor/restrição/equipamento), ele busca alternativa segura.
Hoje, sem metadados, **nenhuma** alternativa é marcada como segura → risco de `safe_alternative_unavailable`
e de comparação injusta no shadow. Garantindo **≥3 alternativas seguras por padrão** (após a curadoria
aprovar estas sugestões), o engine sempre encontra um substituto curado no mesmo padrão → **derruba** o
blocker `safe_alternative_unavailable` e melhora a qualidade da substituição (um dos thresholds de liberação
do shadow no plano de curadoria, §7).

## 6. Nada foi aplicado no banco
Confirmado: somente `SELECT` read-only + criação de `.md`/`.csv`. **Sem** INSERT/UPDATE/DELETE, migration,
ou alteração de engine/edge/UI. Todas as linhas estão `needs_review`.

## 7. Próximo passo recomendado
1. Curador valida/edita o CSV (marca `approved`/`edited`/`rejected`).
2. Aplicar **só o aprovado** via upsert em `exercise_metadata` (+ `equipment` em `exercise_library`) — **ordem
   futura, com backup/plano**, não fake.
3. Rodar `audit.sql` (bloco 7) antes/depois e confirmar `essential_patterns_below_3_safe = 0`.
4. Combinar com o pacote de alto risco (ORDEM 024) para zerar os dois gatilhos de `BLOCKED_FOR_SHADOW`.
