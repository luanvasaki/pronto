# Módulo `companies` — referência

> Perfil de empresa, dashboard, notificações, histórico de trabalhadores. Rotas montadas em `company-profile.routes.ts`.

## Rotas (todas atrás de `requireAuth`)

| Rota | Função |
|---|---|
| `GET/PUT /company-profile` | Ver/atualizar perfil da empresa |
| `GET /company-profile/ratings` | Avaliações recebidas |
| `GET /company-profile/notifications` | Sino de notificações |
| `GET /company-profile/dashboard` | Painel (cobertura 48h + ações) |
| `GET /company-profile/growth-metrics` | Vagas publicadas/trabalhadores contratados/escalas concluídas, últimas 8 semanas |
| `GET /company-profile/worker-history` | Histórico agregado de trabalhadores |
| `GET /company-profile/live-event` | Operação ao vivo do dia |
| `POST /company-profile/logo` | Upload de logo |
| `POST /company-profile/document` | Upload de documento (só pessoa física) |

## Sino de notificações (`get-notifications.ts`)

Quatro categorias, nenhuma com campo próprio de "lido/não lido" — o evento de negócio que resolve a pendência também some da lista sozinho:

1. **Candidaturas pendentes** — `applications.status = 'pending'`.
2. **Check-in não confirmado** — turnos `checked_in` OU `checked_out` com `checkInConfirmedAt IS NULL`. Aparece nos dois status porque check-in e check-out são confirmados de forma independente.
3. **Check-out não confirmado** — turnos `checked_out` com `checkOutConfirmedAt IS NULL`.
4. **Avaliação pendente** — turnos `completed` sem rating da empresa ainda.

Lista limitada a 20 itens por categoria; contadores refletem o total real.

## Dashboard (`get-company-dashboard.ts`)

Métrica-herói: **cobertura das próximas 48h** — soma de posições totais vs. preenchidas de todas as vagas não canceladas nessa janela, `null` (não 0%/100%) quando não há vaga na janela. `openPositionJobs`: até 10 vagas abertas futuras com posição vaga, ordenadas por data.

## Métricas de crescimento (`get-company-growth-metrics.ts`)

Mesmo bucket semanal (segunda a domingo, últimas 8 semanas, zero-fill) do `getAdminGrowthMetrics` — a lógica de janela vive em `apps/backend/src/shared/growth-weeks.ts`, compartilhada pelos dois. Recorte por `jobs.companyId`: vagas publicadas (`jobs.createdAt`), trabalhadores contratados (`shifts.createdAt`, join com `jobs`) e escalas concluídas (`shifts.checkOutAt` com `status = 'completed'`, mesmo join).

## Perfil / métricas (`get-company-profile.ts`)

`avgRating`/`avgCategoryScores` recalculados a cada leitura (pega avaliações que só ficaram visíveis pelo prazo de 7 dias vencer). `jobsPosted` é `count(*)` ao vivo — **não confiar em `totalJobsPosted`** (coluna morta, ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md)). `rehireRate`: % de trabalhadores com 2+ turnos completos com a empresa. Resumo do mês corrente (calendário, não janela móvel): vagas abertas, trabalhadores contratados, "mais contratado do mês".

## Histórico de trabalhadores (`get-company-worker-history.ts`)

Agrega por trabalhador (não por vaga) todo mundo que já teve pelo menos um turno resolvido (`completed` ou `no_show`) com a empresa. Ordenado por taxa de comparecimento, depois volume. **Nota**: como `no_show` nunca é escrito na prática, essa taxa hoje nunca reflete falta real (ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md)).

## Operação ao vivo (`get-live-event-status.ts`)

Estados (`aguardando`/`atrasado`/`chegou`/`concluido`) calculados na hora, comparando agora com o horário de início da vaga + 15 min de tolerância — nunca lidos do banco, nunca persistidos.

## Cadastro e verificação

Upsert do perfil (`upsert-company-profile.ts`) — trocar razão social/CNPJ/CPF depois de `approved` **reseta `verificationStatus` pra `pending`** (o admin verificou os dados antigos, não os novos). Reenviar documento depois de `rejected` também volta pra `pending`, senão a empresa ficaria travada pra sempre (`create-job` exige aprovação).
