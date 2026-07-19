# Módulo `applications` — referência

> Candidatura de um trabalhador a uma vaga. Vocabulário: [`02-product/glossary.md`](../../02-product/glossary.md).

## Rotas (todas atrás de `requireAuth`)

| Rota | Quem chama | Função |
|---|---|---|
| `POST /jobs/:jobId/applications` | Trabalhador | Candidatar-se |
| `GET /applications/mine` | Trabalhador | Listar as próprias candidaturas |
| `GET /jobs/:jobId/applications` | Empresa | Listar candidatos de uma vaga |
| `PATCH /applications/:id` | Empresa | Aprovar/rejeitar |
| `PATCH /applications/:id/seen` | Trabalhador | Marcar resultado como visto |
| `PATCH /applications/:id/removal-seen` | Trabalhador | Marcar remoção como vista |
| `PATCH /applications/:id/remove` | Empresa | Desfazer uma aprovação |
| `PATCH /applications/:id/withdraw` | Trabalhador | Desistir |

## Máquina de estados

`pending` → `approved` (cria o turno) | `rejected` (direto, ou via cancelamento da vaga) | `withdrawn` (só o próprio trabalhador, só enquanto `pending`, irreversível).

`approved` → `rejected` **com** `removedAt` setado (empresa desfaz, ou vaga cancelada) — usa o mesmo valor de status que uma rejeição comum, diferenciado só pelo campo `removedAt`.

Nenhuma transição de volta pra `pending`/`approved` a partir de `rejected`/`withdrawn` — candidatura respondida é terminal.

## Regras de negócio

**Criar candidatura** (`create-application.ts`), em cadeia:
1. Trabalhador com `kycStatus = 'approved'`.
2. Termos aceitos.
3. Dono da empresa não pode se candidatar à própria vaga (evita ambiguidade em quem avalia quem).
4. Vaga `open` e não cheia; prazo de candidatura não vencido.
5. CNH e idade mínima bloqueiam de verdade aqui (diferente do "aviso" na listagem de vagas próximas).
6. Duplicata bloqueada por checagem prévia + índice único, com corrida tratada.

**Aprovar/rejeitar** (`update-application-status.ts`) — o ponto de integração jobs↔applications↔shifts:
- UPDATE condicional (`WHERE status = 'pending'`) fecha a corrida de aprovar duas vezes.
- Reconfere `positionsFilled < positionsTotal` e `minorsAllowed` **de novo** no momento da aprovação (a empresa pode ter mudado a vaga depois que a candidatura ficou pendente).
- Dentro de uma transação: atualiza `applications.status`; incrementa `jobs.positionsFilled` (marca `filled` se atinge o total); **cria a linha em `shifts`** com `payAmountSnapshot` congelado do valor da vaga naquele momento.

**Desfazer aprovação** (`remove-approved-worker.ts`): só se o turno não estiver `checked_in`/`completed`. Decrementa `positionsFilled` via expressão SQL (`greatest(positions_filled - 1, 0)`), não um valor lido antes — evita perda de decremento em remoções simultâneas. Reabre a vaga se estava `filled`.

**Desistência** (`withdraw-application.ts`): só o próprio trabalhador, só enquanto `pending` — depois de aprovado, o caminho correto é a empresa remover (porque já mexe em vaga preenchida/turno).

**Listagens**: candidatos ordenados por nota média (melhor avaliado primeiro), com `previousShiftsWithCompany` e `experienceMismatch` como contexto pra decisão da empresa.
