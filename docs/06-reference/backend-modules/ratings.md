# Módulo `ratings` — referência

## Rotas

| Rota | Quem chama | Função |
|---|---|---|
| `POST /shifts/:id/rating` | Trabalhador ou empresa | Avaliar a outra parte do turno |
| `PATCH /shifts/:id/skip-rating` | Trabalhador ou empresa | Pular avaliação (marca `workerRatingSkippedAt` ou `companyRatingSkippedAt`, conforme quem chama) |

## Categorias

Trabalhador avalia empresa: `COMPANY_RATING_CATEGORIES` (pontualidade de pagamento, clareza da vaga, respeito, comunicação, ambiente). Empresa avalia trabalhador: `WORKER_RATING_CATEGORIES` (pontualidade, educação, proatividade, comunicação, qualidade). Nota geral (`score`) é a **média calculada no servidor** das notas por categoria — o cliente nunca envia o `score` direto.

## Visibilidade "às cegas"

`isRatingRevealed(siblingExists, checkOutAt)`: revela a nota assim que **o outro lado também avaliou**, ou depois de **7 dias** do check-out — o que vier primeiro. Não existe coluna "revelado" nem cron — calculado ao vivo em toda leitura. Ao criar uma avaliação, os agregados (`avgRating`/`avgCategoryScores`) dos dois lados são recalculados juntos, pra revelar os dois no mesmo instante quando o par completa.

## Regras

- Só avalia turno `completed`.
- Um rating por (turno, papel de quem avalia) — segunda tentativa é bloqueada por índice único, com corrida tratada.
- `raterRole` é sempre derivado da identidade de quem chama, nunca enviado pelo cliente.
- **Skip** (`skip-rating.ts`) — mesma derivação de papel do `raterRole`: se quem chama é o trabalhador do turno, marca `workerRatingSkippedAt`; senão precisa ser o dono da empresa da vaga, e marca `companyRatingSkippedAt`. Não bloqueia avaliar depois, só esconde o formulário enquanto não decidido.
