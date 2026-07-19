# Visão geral de arquitetura — Pronto

> Como as peças se encaixam. Detalhe de cada peça em [`backend-architecture.md`](./backend-architecture.md), [`frontend-architecture.md`](./frontend-architecture.md), [`database-schema.md`](./database-schema.md) e [`integrations.md`](./integrations.md).

## O monorepo

Repositório único (`luanvasaki/pronto`, nome interno `shift`), npm workspaces, Node 20.

```
apps/
  backend/    — Express + Drizzle ORM + Postgres
  worker/     — Next.js App Router — app do trabalhador
  business/   — Next.js App Router — app da empresa
  admin/      — Next.js App Router — painel administrativo, login próprio
packages/
  shared/     — cliente HTTP, validadores, formatadores, tipos — sem componentes visuais
```

Cada app frontend é um deploy independente no Vercel (Root Directory = `apps/<nome>`), com deploy automático a cada push. O backend é um único serviço no Railway, com deploy automático + migration de banco rodando sozinha a cada deploy (`npm start` = `drizzle-kit migrate && node dist/server.js`).

`packages/shared` não tem build — os 3 apps front importam direto do `.ts` fonte (`transpilePackages` no `next.config.ts` de cada um). Ele existe só pra compartilhar **lógica** (cliente de API, validação, formatação) entre os apps — nunca componentes React. Cada app mantém sua própria UI, mesmo que visualmente pareça duplicada (ver nota em [`frontend-architecture.md`](./frontend-architecture.md)).

## Por que 3 apps frontend separados, e não 1 com rotas diferentes por papel

Trabalhador, empresa e admin são públicos completamente diferentes, com necessidade de deploy/rollback independentes (o admin, por exemplo, foi extraído do app da empresa numa refatoração — ver [`06-reference/`](../06-reference/)) e sem necessidade de compartilhar UI. Separar em apps distintos evita que uma mudança no app da empresa arrisque quebrar o app do trabalhador, e permite que cada um tenha seu próprio ciclo de release.

## O padrão de módulo do backend

Toda funcionalidade do backend segue a mesma estrutura de arquivo, sem exceção:

```
modules/<domínio>/
  <verbo>.ts              — função de domínio pura (regra de negócio, sem Express)
  <verbo>.controller.ts   — parseia req, chama a função, formata resposta, next(error)
  <domínio>.routes.ts     — monta o Router, aplica middlewares (auth, rate limit)
```

Isso separa regra de negócio de protocolo HTTP — a função de domínio pode ser testada e reutilizada sem precisar simular uma requisição Express. Onde uma rota depende de um serviço externo trocável (envio de e-mail, verificação de token do Google, gateway de pagamento), o controller ou o módulo de rotas usa uma fábrica (`create<X>Handler(dependência)`), permitindo injetar um dublê nos testes e o serviço real em produção — ver [`integrations.md`](./integrations.md).

## Os módulos de domínio

`auth`, `companies`, `jobs`, `applications`, `shifts`, `payments`, `ratings`, `workers`, `skill-categories`, `questions`, `announcements`, `push`, `admin`, `health`. Cada um documentado em detalhe em [`06-reference/backend-modules/`](../06-reference/).

## Fluxo de dados de ponta a ponta (exemplo: aprovar uma candidatura)

1. App da empresa chama `PATCH /applications/:id` com `status: 'approved'`.
2. `applications.routes.ts` aplica `requireAuth` + rate limit, chama o controller.
3. `update-application-status.ts` (função de domínio) roda dentro de uma transação: atualiza a candidatura (UPDATE condicional pra evitar aprovar duas vezes em corrida), incrementa `positionsFilled` da vaga, e **cria a linha em `shifts`** — é aqui que uma candidatura vira um compromisso de trabalho real.
4. A resposta HTTP volta pro app da empresa, que atualiza a lista de candidatos na tela.

Esse é o padrão geral: a lógica de negócio pesada mora na função de domínio, dentro de transações quando mexe em mais de uma tabela, com corrida tratada por UPDATE condicional em vez de lock explícito (ver [`backend-architecture.md`](./backend-architecture.md)).
