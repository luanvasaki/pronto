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

**Cuidado com fixture entre arquivos de teste**: todo teste bate no mesmo Postgres, sem schema isolado por arquivo. `fileParallelism: false` (`vitest.config.ts`) faz os arquivos rodarem em sequência hoje, então um valor fixo (telefone, CNPJ) reusado em dois arquivos diferentes não colide na prática — mas continua sendo uma colisão esperando acontecer se a suíte crescer e alguém precisar ligar paralelismo de novo por velocidade. Por isso a regra continua: cada arquivo de teste precisa dos seus próprios valores únicos, não só únicos dentro do próprio arquivo. Não existe rede de segurança automática pra isso — é disciplina manual, e um arquivo que esquece um `afterEach` completo pode deixar linha órfã que enviesa silenciosamente um teste de métricas rodando depois dele.

**Limpando o que um teste criou**: cada teste que insere `users`/`companies`/`jobs` precisa desfazer isso no `afterEach`, na ordem certa — `jobs.company_id`/`category_id` não têm `onDelete: cascade` de propósito (ver `db/schema/jobs.ts`), então deletar o usuário dono sem apagar `payments`/`shifts`/`applications`/`jobs` primeiro derruba com violação de FK. `src/test-helpers/cleanup.ts` tem `deleteCompanyJobsAndDependents(ownerUserId)` fazendo exatamente essa cascata — reduz o boilerplate repetido em testes novos (testes existentes não foram migrados pra usar isso, é opt-in).

## Armazenamento de arquivos (Vercel Blob)

Dois stores diferentes, porque o Blob rejeita gravar com `access` que não bate com o tipo do store — não dá pra usar o mesmo token pros dois:

- `shift-documents` (`access: private`) — documento de identidade do trabalhador (CNH/RG). Ler exige o token, não só conhecer a URL. Token vai em `BLOB_DOCUMENTS_TOKEN`.
- `shift-public` (`access: public`) — foto de perfil do trabalhador e logo da empresa, pensadas pra aparecer num `<img>` comum. Token vai em `BLOB_READ_WRITE_TOKEN`.

Sem a variável correspondente, `createFileStorage(access)` cai pro disco (`uploads/`) pra aquele tipo de arquivo — é o que os testes usam (a suíte zera as duas de propósito em `vitest.config.ts` pra nunca depender de rede nem sujar o Blob real).

Provisionar um store novo (outra máquina, outro ambiente):

```bash
vercel link                                          # uma vez por máquina
vercel blob create-store shift-documents --access private
vercel blob create-store shift-public --access public
vercel env pull                                       # baixa os tokens pro .env.local — copie pro apps/backend/.env
```

Baixar o documento nunca vai direto pelo Blob a partir do cliente — sempre passa pelo proxy autenticado em `GET /admin/documents/:id/file` (`get-document-file.controller.ts`), que é quem decide *quem* pode ver aquele documento. Foto/logo, por serem públicos, são servidos direto pela URL do Blob.

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
