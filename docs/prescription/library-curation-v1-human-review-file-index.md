# Índice de Arquivos — Handoff de Revisão Humana (Curadoria v1)

> **ORDEM 035.** O que enviar ao revisor, o que pode ser editado e o que é interno. **Nada aplicado
> no banco.** Approved manifests vazios/só header.

## Tabela de arquivos
| Arquivo | Finalidade | Enviar ao revisor? | Editar? | Prioridade | Observações |
|---|---|---|---|---|---|
| `library-curation-v1-p1-human-review.csv` | Planilha de revisão P1 (alto risco) | **Sim** | **Sim** (só campos permitidos) | P1 | 51 linhas; começar por aqui |
| `library-curation-v1-p2-human-review.csv` | Planilha de revisão P2 (compostos moderados) | **Sim** | **Sim** (só campos permitidos) | P2 | 78 linhas |
| `library-curation-v1-p3-human-review.csv` | Planilha de revisão P3 (isolados/acessórios) | **Sim** | **Sim** (só campos permitidos) | P3 | 86 linhas |
| `library-curation-v1-human-review-handoff.md` | Guia principal de handoff | **Sim** | Não | Todas | Regras, estados, linguagem segura |
| `library-curation-v1-human-review-email-template.md` | Modelos de mensagem (e-mail + WhatsApp/Slack) | Não (uso interno p/ enviar) | Sim (preencher `[...]`) | Todas | Preencher antes de enviar |
| `library-curation-v1-human-review-return-protocol.md` | Protocolo de processamento do retorno | Não (interno ATENA) | Não | Todas | Validar → approved manifest → backup/staging |
| `library-curation-v1-p1-human-review-packet.md` | Instruções detalhadas P1 | **Sim** | Não | P1 | Critérios approved/rejected/needs_more_info |
| `library-curation-v1-p1-human-review-return-checklist.md` | Checklist de retorno P1 | **Sim** | Não | P1 | Conferência antes de aceitar de volta |
| `library-curation-v1-human-review-packets-index.md` | Índice dos pacotes P1/P2/P3 | Opcional | Não | Todas | Visão geral |
| `library-curation-v1-review-board.md` | Regras gerais do Review Board | Opcional | Não | Todas | Papéis, estados, critérios |
| `library-curation-v1-approved-manifest-p1.csv` | Saída: aprovados P1 | Não | Não (gerado) | P1 | **Vazio/só header** |
| `library-curation-v1-approved-manifest-p2.csv` | Saída: aprovados P2 | Não | Não (gerado) | P2 | **Vazio/só header** |
| `library-curation-v1-approved-manifest-p3.csv` | Saída: aprovados P3 | Não | Não (gerado) | P3 | **Vazio/só header** |
| `library-curation-v1-approved-manifest-p1-report.md` | Relatório do builder P1 | Não | Não (gerado) | P1 | `NO_APPROVED_ROWS` |
| `library-curation-v1-approved-manifest-p2-report.md` | Relatório do builder P2 | Não | Não (gerado) | P2 | `NO_APPROVED_ROWS` |
| `library-curation-v1-approved-manifest-p3-report.md` | Relatório do builder P3 | Não | Não (gerado) | P3 | `NO_APPROVED_ROWS` |
| `library-curation-v1-consolidated-manifest.csv` | Fonte da verdade (215 exercícios) | Não | Não | Todas | Base de ids/nomes reais |
| `scripts/prescription/validate-curation-review-board.mjs` | Validador offline | Não | Não | — | Checa o CSV revisado |
| `scripts/prescription/build-approved-curation-manifest.mjs` | Gera approved manifest | Não | Não | — | Só `approved` + `ready_for_upsert=true` |
| `scripts/prescription/build-human-review-packet.mjs` | Gera pacote por prioridade | Não | Não | — | Reusável P1/P2/P3 |

## Legenda
- **Enviar ao revisor?** — arquivos que vão para o professor/curador.
- **Editar?** — quem o revisor pode editar (apenas campos permitidos: ver handoff §5). Arquivos
  "gerados" são produzidos pelos scripts e **não** devem ser editados à mão.
- Os **approved manifests** permanecem **vazios/só header** até a revisão humana ser aplicada (com nova ordem).
