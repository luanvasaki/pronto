# backend

API do marketplace (Node.js + TypeScript, CommonJS), monolito modular.

## Rodando localmente

```bash
npm install --workspace=apps/backend   # a partir da raiz do monorepo
npm run dev --workspace=apps/backend   # servidor com reload em src/server.ts
```

Servidor sobe em `http://localhost:4000` (configurável via `.env`, veja `.env.example` — a porta é 4000, não 3000, pra não brigar com o Next.js do `worker`/`business`). Precisa do Postgres local rodando — veja o README na raiz do monorepo.

## Banco de dados

```bash
npm run db:generate --workspace=apps/backend   # gera SQL a partir do schema em src/db/schema
npm run db:migrate --workspace=apps/backend    # aplica migrações pendentes no DATABASE_URL do .env
```

Nunca editar um arquivo em `migrations/` à mão depois de gerado — mudança de schema é sempre um novo `db:generate`.

Em produção, `npm start` já roda `drizzle-kit migrate` antes de subir o servidor (ver script `start` em `package.json`) — não existe passo manual de deploy que precise ser lembrado. `db:migrate` acima serve só pro banco local, durante o desenvolvimento.

## Testando

```bash
npm test --workspace=apps/backend        # roda uma vez
npm run test:watch --workspace=apps/backend
```

Os testes de rota usam `supertest` contra o `app` exportado de `src/app.ts` (nenhuma porta de rede real é aberta). Os testes de schema/repositório usam o Postgres real do `.env` — por isso precisam do banco local de pé.

**Cuidado com fixture entre arquivos de teste**: o Vitest roda arquivos em paralelo contra o mesmo banco. Um valor fixo (telefone, CNPJ) reusado em dois arquivos diferentes colide sob concorrência de forma intermitente — cada arquivo de teste precisa dos seus próprios valores únicos, não só únicos dentro do próprio arquivo.

## Armazenamento de documentos (KYC)

Documento de identidade do trabalhador vai pro Vercel Blob (store `shift-documents`, `access: private` — ler exige o token, não só conhecer a URL). `BLOB_READ_WRITE_TOKEN` já está no `.env` local; sem essa variável, `createFileStorage()` cai pro disco (`uploads/`), que é o que os testes usam (a suíte zera essa variável de propósito em `vitest.config.ts` pra nunca depender de rede nem sujar o Blob real).

Provisionar um store novo (outra máquina, outro ambiente):

```bash
vercel link                                          # uma vez por máquina
vercel blob create-store shift-documents --access private
vercel env pull                                       # baixa BLOB_READ_WRITE_TOKEN pro .env.local — copie pro apps/backend/.env
```

Baixar o arquivo nunca vai direto pelo Blob a partir do cliente — sempre passa pelo proxy autenticado em `GET /admin/documents/:id/file` (`get-document-file.controller.ts`), que é quem decide *quem* pode ver aquele documento.

## Conceder acesso de admin

Não existe rota nenhuma pra virar admin — é deliberado, já que isso libera aprovar/rejeitar KYC de trabalhador e verificação de empresa. Só via update direto no banco:

```sql
UPDATE users SET is_admin = true WHERE phone = '+55...';
```

Com isso a conta acessa `/admin` no app `business` (que também é o painel admin, não só o app da empresa).

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
