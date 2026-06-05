## Objetivo

Hoje nada acontece automaticamente quando um contrato/ciclo termina: o aluno continua "Ativo", a inadimplência é marcada na mão e não há um lugar para ver quem precisa renovar. Vamos automatizar o ciclo de vida da matrícula para que, ao terminar o contrato **ou** o último ciclo de treino, o aluno passe para um estado **"Aguardando renovação"**, e marcar inadimplência automaticamente quando o pagamento vence. (Envio de oferta/novo plano fica para depois — agora é só organizar os status.)

## Como vai funcionar

```text
Matrícula ATIVA
   │
   ├─ data fim do contrato passou (end_date < hoje)        ─┐
   ├─ OU último ciclo de treino terminou (sem ciclo ativo)  ├─►  AGUARDANDO RENOVAÇÃO
   │                                                         ┘    (aluno + matrícula)
   │
   └─ vencimento do pagamento passou sem pagar  ──►  matrícula marcada INADIMPLENTE
```

Quem está em "Aguardando renovação" continua visível num painel próprio (não some da plataforma), com aviso de inadimplência quando houver, pronto para você renovar ou inativar manualmente.

### 1. Novos estados
- Matrícula (`enrollments.status`): novo valor `awaiting_renewal`.
- Aluno (`students.status`): novo valor `awaiting_renewal` ("Aguardando Renovação"), além de active/pending/inactive já existentes.

### 2. Rotina automática diária (e ao abrir o painel)
Criar uma função no banco `process_enrollment_lifecycle()` que roda todo dia (via agendamento pg_cron) e também é disparada ao abrir o dashboard (mesmo padrão do `advance_training_cycles` atual), fazendo:

- **Avançar ciclos** (mantém o `advance_training_cycles` atual).
- **Marcar "Aguardando renovação"** nas matrículas hoje `active` quando:
  - a data de fim do contrato (`end_date`) já passou; **ou**
  - já existe `training_start_date` e o último ciclo de treino terminou (nenhum ciclo `active`/`pending` restante).
  - (Matrículas `awaiting_training` / sem data de treino são ignoradas — não entram como renovação.)
- **Atualizar status do aluno**: se o aluno não tem nenhuma matrícula `active`/`awaiting_training`, mas tem alguma `awaiting_renewal`, o aluno vira `awaiting_renewal`. Renovar (criar matrícula nova ativa) o traz de volta para `active` automaticamente.
- **Inadimplência automática**: pagamentos com vencimento (`due_date`) passado e ainda não quitados passam a `OVERDUE`, e a matrícula correspondente recebe `payment_status = overdue`. (Os pagamentos vindos do Asaas já chegam como OVERDUE pelo webhook; isto cobre os lançamentos manuais/sem Asaas.)

### 3. Ajustes de interface
- **Lista de Alunos** (`StudentsManager`): adicionar rótulo, cor e filtro "Aguardando Renovação"; garantir que esses alunos não fiquem escondidos.
- **Detalhe do Aluno** (`StudentDetail`): mostrar o badge "Aguardando Renovação" e o status de inadimplência da matrícula.
- **Painel do treinador/admin** (`RenewalsAndCyclesPanel`): além do card "RENOVAÇÃO" atual (vence em até 30 dias), incluir os já vencidos em "Aguardando renovação", com destaque de inadimplência, para você agir.
- Revisar os lugares que filtram matrículas por `active`/`awaiting_training` para que o novo estado não quebre buscas (ex.: detalhe do aluno continua achando a matrícula certa).

## Detalhes técnicos

- Migração: adicionar valores `awaiting_renewal` aos enums/checagens de status de `enrollments` e `students` (se forem CHECK/texto, ajustar conforme o tipo atual).
- Função SQL `process_enrollment_lifecycle()` (SECURITY DEFINER, search_path public) concentrando: avanço de ciclos, transição para `awaiting_renewal`, sincronização do status do aluno e marcação de inadimplência por `due_date`.
- Agendamento diário com `pg_cron` chamando a função (SQL puro, sem edge function). Habilitar `pg_cron` se necessário.
- Disparo no carregamento do dashboard via `supabase.rpc("process_enrollment_lifecycle")`, substituindo/expandindo a chamada atual de `advance_training_cycles`.
- Detecção de "último ciclo terminou": não existe ciclo `active` nem `pending` para a matrícula e o maior `end_date` de ciclo já passou.
- Inadimplência: base na tabela `payments` (`due_date < hoje` e `status` fora de CONFIRMED/RECEIVED/RECEIVED_IN_CASH) refletindo em `enrollments.payment_status = 'overdue'`.

## Fora de escopo (agora)
- Envio automático de oferta/novo plano por WhatsApp — fica para uma etapa futura; este plano só deixa os status e a inadimplência corretos e visíveis.