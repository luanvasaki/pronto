# Módulo `shifts` — referência

> Turno de trabalho, nascido de uma candidatura aprovada. Vocabulário e máquina de estados resumida: [`02-product/glossary.md`](../../02-product/glossary.md). Este é o módulo que passou pela mudança de remoção de geolocalização — descrição aqui é do estado **atual**.

## Rotas (`shifts.routes.ts`, `requireAuth` + rate limit de escrita)

| Rota | Quem chama | Função |
|---|---|---|
| `GET /shifts/mine` | Trabalhador | Lista os próprios turnos |
| `POST /shifts/:id/check-in` | Trabalhador | Check-in (sem geolocalização) |
| `POST /shifts/:id/check-out` | Trabalhador | Check-out (sem geolocalização) |
| `POST /shifts/:id/check-in/confirm` | Empresa | Confirma a chegada |
| `POST /shifts/:id/check-out/confirm` | Empresa | Confirma a saída — fecha o turno e dispara a cobrança |

## Máquina de estados

`scheduled` → **check-in do trabalhador** → `checked_in` (UPDATE condicional `WHERE status = 'scheduled'`) → **check-out do trabalhador** → `checked_out` (UPDATE condicional `WHERE status = 'checked_in'`, **não depende** de o check-in ter sido confirmado) → **confirmação de check-out da empresa** → `completed` (UPDATE condicional `WHERE status = 'checked_out'`).

`confirmCheckIn` **não muda o status** — só grava `checkInConfirmedAt`, aceita tanto `checked_in` quanto `checked_out` (o trabalhador pode já ter saído antes da empresa confirmar a chegada), e é idempotente.

`no_show` e `cancelled` existem no enum; `cancelled` é escrito só pelo módulo `applications` (remoção de aprovação / cancelamento de vaga); `no_show` **nunca é escrito** (ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md)).

## O que mudou: geolocalização removida do check-in/check-out

Antes, check-in/check-out validavam a distância entre a localização enviada pelo celular e a da vaga (raio de tolerância), o que causava bloqueios incorretos por imprecisão de GPS. Hoje, nenhum dos dois recebe ou grava lat/lng — as colunas continuam no schema e na resposta da API só por compatibilidade histórica, sempre `null` daqui pra frente. A geolocalização usada pra "vagas perto de você" (módulo `jobs`) é uma funcionalidade completamente separada e continua ativa.

## Notificação por push

Tanto check-in quanto check-out disparam uma notificação push pra empresa (best-effort — try/catch que só loga, nunca derruba o fluxo principal do check-in/out em si).

## Integração com pagamento

A confirmação de check-out é o gatilho de `chargeForShift` (módulo `payments`) — ver [`payments.md`](./payments.md).
