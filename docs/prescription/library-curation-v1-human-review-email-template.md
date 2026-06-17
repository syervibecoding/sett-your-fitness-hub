# Template de Mensagem — Envio ao Revisor (Curadoria v1)

> **ORDEM 035.** Modelos prontos para enviar os pacotes P1/P2/P3 ao professor/curador. **Nada será
> aplicado no banco sem validação posterior.** Preencha os campos entre `[...]` antes de enviar.

---

## Versão e-mail (formal)

**Assunto sugerido:**
`Revisão da curadoria da biblioteca (P1/P2/P3) — sugestões de metadados de segurança`

**Mensagem:**

Olá, [nome do professor/curador],

Preparei a curadoria dos metadados de segurança da nossa biblioteca de exercícios para a sua
**revisão técnica**. São **sugestões** (contraindications, pain tags, regressões, substitutos,
progressões, equipamento) — **nada foi aplicado** no sistema e nada será aplicado sem a sua aprovação
e uma validação automática posterior.

**O que revisar (planilhas CSV em anexo):**
- **P1 — alto risco (51 exercícios):** overhead/desenvolvimentos, terra/hinge carregado, carga axial,
  joelho profundo, múltiplas regiões de risco. **Comece por aqui.**
- **P2 — compostos moderados (78 exercícios).**
- **P3 — isolados/acessórios/opções seguras (86 exercícios).**

**Ordem recomendada:** P1 → P2 → P3.

**Como preencher (por linha):**
- Escolha `reviewer_status`: `approved`, `rejected` ou `needs_more_info`.
- Para `approved`: preencha `reviewer_name`, `reviewed_at`, `approval_decision_reason` e
  `ready_for_upsert=true`. Se houver conflito ou múltiplas regiões de risco, preencha `reviewer_notes`.
- Para `rejected`: explique em `approval_decision_reason`.
- Para `needs_more_info`: explique em `reviewer_notes` o que falta.
- Use linguagem de **cautela/restrição/tolerância** — **sem diagnóstico clínico**; na dúvida, conservador.

**Importante:**
- **Não altere** `exercise_id`, `exercise_name`, `muscle_group`, `max_priority`, `risk_regions`,
  `movement_patterns`, `source_packages`.
- **Não renomeie colunas, não apague linhas, não converta o CSV em PDF/print.**

**Anexos:**
- `library-curation-v1-p1-human-review.csv`
- `library-curation-v1-p2-human-review.csv`
- `library-curation-v1-p3-human-review.csv`
- `library-curation-v1-p1-human-review-packet.md` (instruções)
- `library-curation-v1-p1-human-review-return-checklist.md` (checklist)

**Como devolver:** responda este e-mail com os 3 CSVs preenchidos, **no mesmo formato**.

**Prazo sugerido:** [_____]

Qualquer dúvida, estou à disposição. Obrigado!
[seu nome]

---

## Versão curta (WhatsApp/Slack)

> Oi [nome]! Te mando 3 planilhas (CSV) da curadoria de segurança da biblioteca pra sua revisão:
> **P1 (alto risco, 51)**, **P2 (78)** e **P3 (86)**. Comece pelo **P1**.
>
> Em cada linha, defina `reviewer_status` = `approved` / `rejected` / `needs_more_info`.
> - `approved`: preencha `reviewer_name`, `reviewed_at`, `approval_decision_reason`, `ready_for_upsert=true`
>   (e `reviewer_notes` se houver conflito/múltiplas regiões).
> - `rejected`: diga o motivo em `approval_decision_reason`.
> - `needs_more_info`: diga o que falta em `reviewer_notes`.
>
> ⚠️ **Não** mexa em `exercise_id`/`exercise_name`/colunas; **não** apague linhas; **não** vire PDF.
> Linguagem de cautela, **sem diagnóstico**. Devolve os CSVs no mesmo formato.
> **Nada é aplicado** sem validação automática depois. Valeu! 🙏
