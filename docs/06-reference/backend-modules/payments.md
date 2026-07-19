# Módulo `payments` — referência

> Rastreio do acerto financeiro do turno. Ver [`01-business/monetization.md`](../../01-business/monetization.md) pra por que isso é hoje uma máquina de honra, não um processamento real de dinheiro.

## Rotas (`payments.routes.ts`, `requireAuth`)

| Rota | Quem chama | Função |
|---|---|---|
| `POST /shifts/:id/payment/release` | Empresa | Marca que já pagou (por fora) |
| `POST /shifts/:id/payment/confirm` | Trabalhador | Confirma recebimento ou contesta |

## Máquina de estados

`pending → charged` (ou `failed`): disparado por `chargeForShift`, chamado de forma best-effort pela confirmação de check-out do módulo `shifts`. Cria a linha de pagamento, chama o gateway (mock, sempre sucede hoje), sucesso vira `charged`, falha vira `failed` e loga o motivo — falha na cobrança **não desfaz** a confirmação de check-out.

`charged → released`: empresa marca como paga (`release-payment.ts`), UPDATE condicional. **Importante**: o UPDATE acontece antes de chamar o gateway externo, de propósito — se fosse ao contrário, duas chamadas simultâneas liberariam em dobro com um PSP de verdade (hoje inofensivo, porque o gateway é mock).

`released → confirmed` (trabalhador confirma recebimento) ou `released → disputed` (trabalhador contesta) — `confirm-payment.ts`, UPDATE condicional.

`disputed` e `refunded`: sem transição posterior modelada no sistema hoje — ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md).

## O gateway

`create-payment-gateway.ts` sempre retorna `MockPaymentGateway` — `charge()` "sucede" instantaneamente, `release()` é no-op. Nenhum PSP real (Pagar.me, Iugu, ou outro) está integrado. Ver [`03-architecture/integrations.md`](../../03-architecture/integrations.md).

## O que muda quando o pagamento passar a ser real

Essa máquina de estados de "confirma se recebeu" existe **porque** o dinheiro não passa pela plataforma. Quando passar, a plataforma vai saber que pagou — o passo de "trabalhador confirma recebimento" deixa de ter razão de existir do jeito que está hoje. Ver [`01-business/monetization.md`](../../01-business/monetization.md) pro detalhe dessa transição.
