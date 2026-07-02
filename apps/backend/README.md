# backend

API do marketplace (Node.js + TypeScript, CommonJS), monolito modular.

## Rodando localmente

```bash
npm install --workspace=apps/backend   # a partir da raiz do monorepo
npm run dev --workspace=apps/backend   # servidor com reload em src/server.ts
```

Servidor sobe em `http://localhost:3000` (configurável via `.env`, veja `.env.example`).

## Testando

```bash
npm test --workspace=apps/backend        # roda uma vez
npm run test:watch --workspace=apps/backend
```

Os testes usam `supertest` contra o `app` exportado de `src/app.ts` — nenhuma porta de rede real é aberta.

## Lint e build

```bash
npm run lint --workspace=apps/backend
npm run build --workspace=apps/backend   # compila para dist/
```

## Estrutura

```
src/
├── app.ts                 monta o Express (sem listen)
├── server.ts               chama app.listen()
├── config/env.ts           leitura de variáveis de ambiente
├── shared/                 erros e middlewares reaproveitados por todos os módulos
└── modules/
    └── health/              primeiro módulo: GET /health
```

Cada novo domínio (vagas, candidaturas, pagamentos...) ganha uma pasta própria em `modules/`.
