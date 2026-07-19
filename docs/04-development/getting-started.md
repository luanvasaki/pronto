# Rodando o projeto localmente — Pronto

> Setup, portas, scripts. Convenções de código e teste em [`conventions.md`](./conventions.md).

## Pré-requisitos

- Node 20+ (`engines.node >= 20` no `package.json` raiz).
- Postgres 16, rodando localmente na porta **5433** (não 5432 — escolhido pra não colidir com outro Postgres já instalado na máquina de desenvolvimento original).

## Banco de dados local

`scripts/setup-local-db.sh` é idempotente — roda quantas vezes precisar sem quebrar nada. Usa o `psql` do Postgres 16 (Homebrew), cria a role `shift` (senha `shift_dev_password`) e o banco `shift_dev` se ainda não existirem.

```bash
./scripts/setup-local-db.sh
cd apps/backend
npm run db:migrate      # aplica as migrations
npm run db:seed         # dados básicos
npm run db:seed-demo    # dados de demonstração (removíveis depois via admin)
```

## Portas de cada app

| App | Porta | Comando |
|---|---|---|
| `apps/backend` | (definida por env) | `npm run dev` (`tsx watch src/server.ts`) |
| `apps/worker` | 3000 | `npm run dev` |
| `apps/business` | 3200 | `npm run dev` |
| `apps/admin` | 3400 | `npm run dev` |

Cada app roda seu próprio `npm run dev` dentro da pasta (`apps/<nome>`), não existe um comando único na raiz que sobe tudo de uma vez.

## Rodando testes

Da raiz, roda a suíte inteira de todos os workspaces: `npm test` (= `npm test --workspaces --if-present`).

Dentro de qualquer app: `npm test` (roda uma vez), `npm run test:watch`, `npm run test:coverage`. O backend usa Postgres de verdade nos testes (não mocka o banco) — precisa do banco local rodando.

## Typecheck e lint

Cada app: `npm run typecheck` (`tsc --noEmit`), `npm run lint` (`eslint`). O backend também tem `npm run format` (`prettier --write .`).

## Migrations do backend

- `npm run db:generate` — gera uma nova migration a partir de mudanças em `src/db/schema/*.ts` (drizzle-kit, interativo se detectar rename ambíguo de coluna).
- `npm run db:migrate` — aplica migrations pendentes.
- Em produção, isso roda **automaticamente** a cada deploy, antes do servidor subir (`npm start` = `drizzle-kit migrate && node dist/server.js`).

## Env vars — o que existe, sem valores

Cada serviço externo (e-mail, Google OAuth, gateway de pagamento, push/VAPID, armazenamento de arquivo) tem uma env var própria que decide entre a implementação real e o fallback de desenvolvimento — ver [`03-architecture/integrations.md`](../03-architecture/integrations.md) pra saber qual env var controla qual serviço e o que acontece em produção sem ela configurada (alguns travam o boot de propósito). Os valores reais de produção nunca devem ser lidos/colados em nenhum documento — só a lista de quais existem, se precisar, deve vir do `.env.local`/`.env.example` do próprio repositório.
