# BN Prescription Engine v1 — QA Metodológico & Documento de Aceite

> **Propósito:** validar a implementação do Codex do engine de prescrição **antes** de promover
> para produção. Este documento é o critério de aceite. Um engine só é "aprovado" quando passa
> 100% das Regras Inegociáveis (§3), 100% dos blockers/handoffs dos Golden Cases (§2) e ≥95% do
> Checklist (§1).
>
> **Alinhado ao motor já deployado** (`ai-prescribe-workout`): RIR 2–4, dor/EVA ≤ 3 como linha
> vermelha, sem pliometria nas semanas 1–2, método avançado só em exercício estável/sem dor
> (bloco 5–6), teto ~16 séries/semana por grupo, periodização de 6 semanas em blocos 1–2 / 3–4 /
> 5–6, **biblioteca-only**, e **regra mais conservadora vence**.
>
> **Escopo v1:** musculação · objetivos {hipertrofia, emagrecimento/recomposição, força geral,
> saúde geral, retorno gradual} · níveis {iniciante, intermediário, avançado} · 2–6 dias/semana ·
> restrições {joelho, lombar, ombro} · progressão 4–6 semanas · deload simples.
>
> **Taxonomia de referência:** 17 grupos da biblioteca (`exercise_library.muscle_group`) e 9
> padrões de movimento: `joelho_dominante, quadril_dominante, empurrar_horizontal,
> empurrar_vertical, puxar_horizontal, puxar_vertical, core, unilateral, isolado_acessorio`.

---

## 1. Checklist de aceite metodológico

Marcar cada item como **PASS / FAIL / N/A**. Critério objetivo entre parênteses.

### 1.1 Contrato de entrada
- [ ] Aceita os 5 objetivos, 3 níveis e 2–6 dias sem erro. (entrada válida → plano; nunca exceção)
- [ ] Entrada inválida/faltante degrada com segurança (default conservador + warning, nunca crash).
- [ ] Consome `injuries[]`, `assessment.ohs_compensations/shortened/weak/contraindicated/caution` e `pain_reports[].eva` quando presentes.
- [ ] Ausência de avaliação não bloqueia o plano — apenas reduz priorização corretiva (warning informativo).

### 1.2 Seleção de split
- [ ] Split escolhido bate com a tabela dias×nível×objetivo (§2.1 da spec).
- [ ] Iniciante nunca recebe split de parte isolada (só full-body/upper-lower).
- [ ] Iniciante com 5–6 dias é rebaixado p/ 3–4 estruturados + extras opcionais (flag emitida).
- [ ] Força geral reduz nº de exercícios/sessão e prioriza compostos.

### 1.3 Cálculo de volume
- [ ] Séries/semana por grupo dentro de `[MEV, MRV]` do perfil (§2 da spec).
- [ ] Nenhum grupo > 16 séries/semana **sem** flag de justificativa (warning `high_weekly_volume_*`).
- [ ] Grupo pequeno usa ~60% do volume de grupo grande (ver §3 — regra inegociável).
- [ ] Grupo lesionado limitado a 6–10 séries "por tolerância e dor ≤ 3".
- [ ] Multiplicador de objetivo aplicado (força ×0.7, saúde ×0.7, retorno ×0.5, hipertrofia ×1.0, emagrecimento ×0.9).

### 1.4 Seleção de exercícios
- [ ] Toda seleção parte de **padrão de movimento**, não de "grupo solto".
- [ ] Todo exercício existe na biblioteca (`exercise_id` resolvível). (0 exercícios inventados)
- [ ] Equilíbrio empurrar/puxar respeitado no horizonte semanal.
- [ ] `role` preservado (composto→composto na substituição quando possível).

### 1.5 Restrições / dor
- [ ] Cada região afetada dispara corte de volume + ban de padrão + corretivo conforme severidade (§5).
- [ ] Exercício em `contraindicated_exercises`/`pain_limitation_tags` nunca aparece no plano final.
- [ ] Joelho: prioriza glúteo médio antes do padrão de agachamento quando há valgo.
- [ ] Lombar: remove flexão espinhal carregada; usa hinge neutro + core anti-extensão/rotação.
- [ ] Ombro: remove atrás-da-nuca/remada alta/dips em dor; prioriza controle escapular + manguito.

### 1.6 Progressão
- [ ] Modelo em blocos 1–2 / 3–4 / 5–6 com RIR decrescente (3–4 → 2–3 → 2).
- [ ] Dupla progressão implementada (topo da faixa + RIR alvo → +carga → reset reps).
- [ ] **Progressão trava com dor > 3** (regra inegociável).
- [ ] Volume sobe no máx +1 série/semana/grupo até MAV/teto.

### 1.7 Deload
- [ ] Deload disparado no fim do bloco de 4–6 semanas (agendado).
- [ ] Receita: volume −40 a 50%, RIR 4–5, sem falha, sem método avançado, padrões mantidos.
- [ ] Pós-deload reinicia bloco em baseline coerente com o progresso.

### 1.8 Explicações BNITO
- [ ] Toda decisão relevante emite explicação com os 6 campos (§4).
- [ ] Nenhuma explicação sem `rule_id` (rastreável a regra disparada).
- [ ] Frases variadas (≥3 variações por categoria; não-robótico).

### 1.9 Biblioteca-only
- [ ] Quando o catálogo existe, **nenhum** exercício fora dele é prescrito.
- [ ] Sem substituto seguro → **blocker/warning**, nunca um exercício inventado (§3).

### 1.10 Compatibilidade com PDF / telas / publicação do aluno
- [ ] O shape de saída do plano não muda os campos que PDF/telas já consomem (contrato estável).
- [ ] Campos novos são aditivos (não renomeiam/removem chaves existentes do plano).
- [ ] Plano publicado renderiza no portal do aluno sem campo faltante (sets/reps/rest/exercise_id presentes).

### 1.11 Segurança / handoff para professor
- [ ] EVA > 5 ou compensação severa → **alert/handoff ao professor** (app não trata).
- [ ] Nenhuma saída contém linguagem de diagnóstico/tratamento clínico.
- [ ] Caso severo gera blocker que impede promover o plano sem revisão humana.

---

## 2. Golden Test Cases

Convenção: **GG** = grupos grandes (costas, peito, quadríceps, posterior, glúteo, ombro);
volumes em **séries/semana**. "Pass/Fail" = critério objetivo de aprovação.

### GC-01 — Iniciante · dor no joelho + valgo dinâmico
- **Input:** iniciante, hipertrofia, 3 dias, academia completa, `injuries=[joelho]`, OHS `dynamic_valgus=moderada`, EVA joelho 3.
- **Split esperado:** Full Body A/B/C.
- **Volume (principais):** GG 10–12; **quadríceps reduzido p/ 6–10** ("por tolerância").
- **Padrões priorizados:** glúteo médio (abdução) ANTES de joelho-dominante; quadril-dominante; puxar.
- **Evitar:** agachamento livre profundo com carga, afundo alto, pliometria; ROM só indolor.
- **Progressão:** bloco 1–2 RIR 3–4; quadríceps progride por tolerância; trava se dor > 3.
- **Deload:** fim do bloco (semana 6).
- **BNITO esperado:** "reduzi quadríceps por dor no joelho"; "priorizei glúteo médio antes do padrão de agachamento"; "evitei método avançado porque o aluno é iniciante".
- **Warnings:** `pain_or_injury_requires_conservative_progression`; possível `knee_volume_capped`.
- **Blockers:** nenhum (EVA ≤ 3).
- **Pass/Fail:** PASS se quadríceps ≤ 10, glúteo médio presente antes de agacho, 0 exercício contraindicado, 0 método avançado, explicações com rule_id. FAIL se houver agachamento profundo carregado ou pliometria.

### GC-02 — Intermediário · dor lombar + butt wink
- **Input:** intermediário, hipertrofia, 4 dias, academia, `injuries=[lombar]`, OHS `butt_wink=moderada`, EVA lombar 4.
- **Split esperado:** Upper/Lower ×2.
- **Volume:** GG 14–16; posterior/lombar **reduzido p/ 6–10**.
- **Padrões priorizados:** hip hinge neutro (RDL leve, hip thrust apoiado), core anti-extensão/rotação (McGill big-3), remada apoiada no peito.
- **Evitar:** terra convencional, good morning, flexão espinhal carregada, agacho pesado, remada livre que exige lombar.
- **Progressão:** RIR 2–3; carga axial limitada; segura progressão no padrão afetado (EVA 4 → hold).
- **Deload:** fim do bloco.
- **BNITO esperado:** "tirei o terra por enquanto pra proteger a lombar"; "troquei remada livre por remada apoiada no peito".
- **Warnings:** dor → progressão conservadora; substituição registrada.
- **Blockers:** nenhum (EVA 4 < 5), **a menos que** um exercício de flexão carregada seja inserido → blocker.
- **Pass/Fail:** PASS se 0 flexão espinhal carregada, core anti-extensão presente, posterior ≤ 10, progressão do padrão lombar segurada.

### GC-03 — Dor no ombro + cifose/protração
- **Input:** intermediário, hipertrofia, 4 dias, academia, `injuries=[ombro]`, OHS `shoulder_protraction_kyphosis=moderada`, EVA ombro 4.
- **Split esperado:** Upper/Lower ×2 (ou PPL se interm/avançado).
- **Volume:** GG 14–16; ombro/peito **reduzido p/ 6–10** no que for doloroso.
- **Padrões priorizados:** retração escapular, deltoide posterior, manguito (rotação externa), empurrar com pegada neutra/landmine, ROM indolor.
- **Evitar:** desenvolvimento atrás da nuca, remada alta, dips, supino em ROM dolorido.
- **Progressão:** RIR 2–3; prioriza controle escapular antes de empurrar pesado.
- **Deload:** fim do bloco.
- **BNITO esperado:** "tirei desenvolvimento atrás da nuca e remada alta pra proteger o ombro"; "priorizei manguito e deltoide posterior".
- **Warnings:** substituição por dor; progressão conservadora.
- **Blockers:** se exercício contraindicado (atrás da nuca/dips) entrar → blocker.
- **Pass/Fail:** PASS se 0 exercício banido de ombro, manguito/escapular presente, ombro ≤ 10.

### GC-04 — Iniciante querendo treinar 6×/semana
- **Input:** iniciante, hipertrofia, 6 dias, academia, sem dor.
- **Split esperado:** **rebaixado** p/ 3–4 dias full-body/UL estruturados + 1–2 dias opcionais leves (mobilidade/cardio), com **flag explícita**.
- **Volume:** GG 10–12 (MEV→MAV iniciante); **não** inflar volume só porque há 6 dias.
- **Padrões priorizados:** padrões fundamentais full-body, técnica.
- **Evitar:** split de parte isolada, alto volume/frequência que não recupera, métodos avançados.
- **Progressão:** base técnica, dupla progressão, RIR 3–4.
- **Deload:** fim do bloco.
- **BNITO esperado:** "como você está começando, estruturei 4 dias e deixei os outros como opcionais leves — recuperação importa mais que frequência agora".
- **Warnings:** `frequencia_rebaixada_iniciante`.
- **Blockers:** nenhum.
- **Pass/Fail:** PASS se não houver 6 dias pesados de musculação para iniciante e a flag for emitida. FAIL se gerar PPL×2 ou volume de intermediário/avançado.

### GC-05 — Corre 3×/semana + quer hipertrofia
- **Input:** intermediário, hipertrofia, 4 dias musculação, sem dor; corre 3×/sem (`days_per_week_cardio=3`, endurance concorrente).
- **Split esperado:** Upper/Lower ×2 (gerencia interferência).
- **Volume:** GG 12–16, com **atenção a membros inferiores** (anti-interferência: não somar volume excessivo de perna sobre a corrida).
- **Padrões priorizados:** força/hipertrofia padrão; perna distribuída pra não competir com a corrida.
- **Evitar:** pernas de alto volume no dia anterior a corrida-chave; falha em joelho-dominante pesado próximo a corrida.
- **Progressão:** RIR 2–3; carga antes de volume em inferiores pra limitar fadiga.
- **Deload:** sincronizado com a carga total (corrida + força).
- **BNITO esperado:** "ajustei o volume de perna pra não competir com seus 3 treinos de corrida".
- **Warnings:** interferência concorrente sinalizada.
- **Blockers:** nenhum.
- **Pass/Fail:** PASS se volume de inferiores reconhecer a corrida (não estourar) e houver nota de anti-interferência.

### GC-06 — Emagrecimento + baixa experiência
- **Input:** iniciante, emagrecimento/recomposição, 3 dias, academia, sem dor.
- **Split esperado:** Full Body A/B/C.
- **Volume:** GG ~9–11 (MAV iniciante × 0.9), preservando **estímulo de força** (mantém carga).
- **Padrões priorizados:** compostos full-body, eficiência metabólica (pareamento antagonista permitido).
- **Evitar:** métodos avançados, volume alto que prejudica adesão; não trocar força por "aerobização" da musculação.
- **Progressão:** dupla progressão, RIR 3–4, técnica.
- **Deload:** fim do bloco.
- **BNITO esperado:** "mantive carga para preservar músculo no emagrecimento"; "evitei método avançado porque o aluno é iniciante".
- **Warnings:** nenhum crítico.
- **Blockers:** nenhum.
- **Pass/Fail:** PASS se mantiver compostos com carga (não vira circuito sem estímulo) e 0 método avançado.

### GC-07 — Avançado · sem dor · hipertrofia
- **Input:** avançado, hipertrofia, 5 dias, academia, sem dor.
- **Split esperado:** PPL + Upper/Lower (ou PPL×2 se 6).
- **Volume:** GG 16–18 (até 20 **com justificativa** flag; default cap 16 dispara warning se exceder sem flag).
- **Padrões priorizados:** todos; frequência ≥2×/grupo.
- **Permitido:** método avançado **apenas** em exercício estável/sem dor, preferencialmente bloco 5–6.
- **Evitar:** ainda assim sem pliometria nas semanas 1–2; sem falha generalizada.
- **Progressão:** RIR 2–3 → 2; dupla progressão + intensificação no bloco 5–6.
- **Deload:** fim do bloco (mais necessário em avançado).
- **BNITO esperado:** "incluí pirâmide só no bloco final, em exercício estável"; "subi o volume de costas pro teto porque você recupera bem".
- **Warnings:** `high_weekly_volume_*` se > 16 sem justificativa.
- **Blockers:** nenhum.
- **Pass/Fail:** PASS se método avançado só aparecer em bloco 5–6 e nunca nas semanas 1–2; volume > 16 só com flag.

### GC-08 — Retorno gradual pós-dor
- **Input:** retorno_gradual, 2–3 dias, dor recente resolvendo (EVA 2), nível efetivo iniciante.
- **Split esperado:** Full Body 2–3×.
- **Volume:** GG **MEV / ×0.5** (6–8); rampa ao longo de 6 semanas.
- **Padrões priorizados:** controle motor, técnica, amplitude indolor, padrões fundamentais leves.
- **Evitar:** método avançado, falha, pliometria, alto volume; nada doloroso.
- **Progressão:** RIR 3–4; subir volume/carga só com dor ≤ 3 e técnica limpa.
- **Deload:** rampa já é conservadora; deload formal no fim se necessário.
- **BNITO esperado:** "comecei leve no retorno, subindo só conforme a dor permitir (≤3)".
- **Warnings:** progressão conservadora por retorno.
- **Blockers:** se dor subir > 5 em qualquer região → blocker + handoff.
- **Pass/Fail:** PASS se volume iniciar em MEV, RIR alto, 0 avançado, rampa presente.

### GC-09 — Equipamento limitado
- **Input:** intermediário, hipertrofia, 4 dias, `equipment=casa_minimo` (halteres/peso corporal), sem dor.
- **Split esperado:** Upper/Lower ×2 adaptado ao equipamento.
- **Volume:** GG 12–16 (mantém alvo via substitutos equivalentes).
- **Padrões priorizados:** todos, com variações de halteres/peso corporal.
- **Substituição:** usar `equivalent_substitutes` por falta de equipamento; preservar volume do alvo.
- **Evitar:** prescrever exercício de máquina/barra inexistente no setup → deve substituir, não manter.
- **Progressão:** dupla progressão; quando carga limita, progride reps/tempo sob tensão.
- **BNITO esperado:** "sem barra/máquina, usei o equivalente com halteres pro mesmo músculo".
- **Warnings:** substituições por equipamento registradas.
- **Blockers:** nenhum se houver substituto; se não houver → blocker (ver GC-10).
- **Pass/Fail:** PASS se 0 exercício exigir equipamento ausente e volume do alvo for preservado.

### GC-10 — Biblioteca sem substituto seguro
- **Input:** qualquer perfil onde o único exercício de um padrão é contraindicado pela dor e **não há** substituto seguro na biblioteca (nem `equivalent_substitutes`, nem regressão, nem variante segura).
- **Split esperado:** normal, mas o padrão afetado fica **sem exercício**.
- **Comportamento esperado:** **NÃO inventar** exercício. Emitir **blocker** (ou warning forte) explicando a lacuna e sugerindo revisão do professor / cadastro de exercício.
- **Padrões priorizados:** os demais seguem normalmente.
- **BNITO esperado:** "não encontrei um exercício seguro na biblioteca para esse padrão sem agravar sua dor — sinalizei para o professor revisar".
- **Warnings:** `no_safe_substitute_in_library`.
- **Blockers:** **sim** — `safe_alternative_unavailable` (impede promover sem revisão humana).
- **Pass/Fail:** PASS se 0 exercício inventado/fora da biblioteca **e** blocker/warning emitido. FAIL se preencher a lacuna com exercício fora do catálogo ou com o próprio contraindicado.

### GC-11 — Caso severo · EVA > 5
- **Input:** qualquer nível, dor severa (EVA 7) em joelho/lombar/ombro, ou compensação `severa`.
- **Split esperado:** plano permitido nos padrões **não** afetados; padrão afetado **removido**.
- **Volume:** grupo afetado no mínimo + bloco corretivo; demais normais.
- **Comportamento esperado:** **blocker** no padrão afetado + **handoff obrigatório ao professor**; linguagem sem diagnóstico/tratamento.
- **Evitar:** qualquer carga no padrão doloroso; progressão travada.
- **BNITO esperado:** "como sua dor está alta (7/10), tirei esse padrão e avisei seu professor — não dá pra eu decidir isso por você".
- **Warnings:** sim.
- **Blockers:** **sim** (`high_pain_requires_professional_review`).
- **Handoff:** **obrigatório**.
- **Pass/Fail:** PASS se houver blocker + handoff + 0 carga no padrão afetado + 0 linguagem clínica. **Falha crítica** se faltar handoff.

### GC-12 — Intermediário · sem dor · 4 dias · hipertrofia padrão (baseline feliz)
- **Input:** intermediário, hipertrofia, 4 dias, academia, sem dor, sem avaliação restritiva.
- **Split esperado:** Upper/Lower ×2.
- **Volume:** GG 14–16; grupos pequenos ~8–10.
- **Padrões priorizados:** todos equilibrados (empurrar/puxar/joelho/quadril), frequência 2×/grupo.
- **Evitar:** > 16 séries sem justificativa; pliometria semanas 1–2; método avançado fora do bloco 5–6.
- **Progressão:** blocos 1–2 / 3–4 / 5–6, dupla progressão, RIR 3–4 → 2.
- **Deload:** semana 6/fim do bloco.
- **BNITO esperado:** explicações de volume/progressão padrão (sem alarmes de segurança).
- **Warnings:** nenhum (caminho limpo).
- **Blockers:** **nenhum** — este é o caso de controle: se gerar warning/blocker indevido, é regressão.
- **Pass/Fail:** PASS se plano válido, 0 warning/blocker espúrio, volumes na faixa, progressão em blocos. Serve de **canário** contra falsos positivos.

---

## 3. Regras inegociáveis

Falha em qualquer uma = **reprovação automática** (não promove para produção).

| # | Regra | Critério objetivo |
|---|---|---|
| R1 | **Dor > 3 trava progressão** | nenhum incremento de carga/volume no padrão com EVA > 3 |
| R2 | **EVA > 5 gera alert/handoff ao professor** | flag de handoff presente + blocker no padrão afetado |
| R3 | **App não diagnostica nem trata clinicamente** | 0 ocorrência de linguagem de diagnóstico/tratamento; só sugere + avisa |
| R4 | **Biblioteca-only quando o catálogo existe** | 100% dos `exercise_id` resolvem no catálogo; 0 inventado |
| R5 | **Sem método avançado para iniciante** | 0 método avançado quando `level=iniciante` |
| R6 | **Sem método avançado com dor** | 0 método avançado em exercício com dor/EVA > 3 |
| R7 | **Sem pliometria nas semanas 1–2** | 0 pliometria/salto no bloco 1–2 (qualquer nível) |
| R8 | **Regra mais conservadora vence** | em conflito metodologia×segurança, prevalece a restrição de segurança |
| R9 | **Grupo pequeno ≠ volume de grupo grande** | volume de grupo pequeno ≤ ~60% do grande do mesmo perfil |
| R10 | **Sem substituto seguro → blocker/warning** | lacuna nunca preenchida por exercício fora da biblioteca/contraindicado |

---

## 4. Auditoria das explicações BNITO

Toda explicação emitida pelo engine **deve** conter:

| Campo | Obrigatório | Exemplo |
|---|---|---|
| `rule_id` | sim | `R1`, `knee_valgus_priority`, `vol_cap_16` |
| `category` | sim | `seguranca · priorizacao · nivel · volume · substituicao · progressao · deload` |
| `source` | sim | `biblioteca · volume · anamnese · avaliacao_funcional · objetivo · nivel · periodizacao · metodologia_bn` |
| `target` | sim | grupo muscular, exercício ou padrão afetado |
| `action` | sim | `reduzir · remover · priorizar · substituir · limitar · progredir · deload` |
| `reason` | sim | causa rastreável (ex.: "dor no joelho 4/10 + valgo moderado") |
| `severity` | quando aplicável | `leve · moderada · severa` / EVA |

**Regra de ouro:** **nenhuma explicação pode ser inventada.** Toda frase exibida tem de derivar de
uma regra que **realmente disparou** (existe um `rule_id` correspondente no log de decisão). Auditar:
para cada frase do plano, existe 1 registro de regra disparada? Se não → FAIL.

---

## 5. Matriz de severidade

| Caso | Ação no exercício | Ação no volume | Ação na progressão | Warning? | Blocker? | Handoff? |
|---|---|---|---|---|---|---|
| **EVA 0–3** | manter padrão + cue técnico | normal | liberada (mas trava se > 3) | não (info opc.) | não | não |
| **EVA 4–5** | substituir por variação amigável / ROM limitado | −1/3 no grupo afetado | **segura/regressa** no padrão | **sim** | não | recomendado |
| **EVA > 5** | **remover** o padrão + corretivo | mínimo no afetado | **travada** | **sim** | **sim** | **obrigatório** |
| **Comp. leve** | cue técnico | normal | normal | info | não | não |
| **Comp. moderada** | substituir + priorizar corretivo | −1/3 no padrão | cautelosa | **sim** | não | recomendado |
| **Comp. severa** | **remover** padrão + corretivo | mínimo no padrão | **travada** | **sim** | **sim** (se contraindicado entrar) | **sim** |

Quando dor (EVA) e compensação coexistem na mesma região, **vale a severidade mais alta** (R8).

---

## 6. Riscos de implementação (o Codex precisa evitar)

| Risco | Por que é grave | Como o QA pega |
|---|---|---|
| Inventar exercício fora da biblioteca | quebra biblioteca-only + segurança | GC-10, R4 |
| Volume alto demais para grupos pequenos | sobrecarga/lesão + recuperação | R9, §1.3 |
| Deixar iniciante treinar 6 dias pesados | overtraining/abandono | GC-04 |
| Método avançado cedo demais | risco técnico/lesão | R5, R6, GC-07 |
| Não travar progressão com dor | agrava lesão | R1, GC-01/02/03 |
| Explicação sem `rule_id` | perde rastreabilidade / "inventa" justificativa | §4 |
| Mudar contrato das telas/PDF | quebra publicação no portal do aluno | §1.10 |
| Acoplar engine puro à UI/React | impede reuso/teste + fere separação de lane | §1.10, arquitetura |
| Quebrar import em Supabase Edge/Deno (Fase B) | engine não roda na edge | revisão de imports na Fase B |

---

### Resultado de aceite (preencher na validação)
- Regras Inegociáveis (§3): __/10 — **exige 10/10**
- Golden Cases blockers/handoff corretos (§2): __/12 — **exige 12/12 nos itens de segurança (GC-01..03, 08, 10, 11)**
- Checklist (§1): __/__ — **exige ≥ 95%**
- Auditoria BNITO (§4): __% de frases com `rule_id` — **exige 100%**

> Só promover o engine para produção com **§3 = 10/10**, **GC de segurança = 100%** e **§4 = 100%**.
