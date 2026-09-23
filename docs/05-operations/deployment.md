# Deploy — Pronto

> Onde cada peça roda e como o deploy acontece. Setup local em [`04-development/getting-started.md`](../04-development/getting-started.md).

## Backend — Railway

Um serviço único no Railway, conectado ao repositório `luanvasaki/pronto`, com deploy automático a cada push na branch de produção. `npm start` roda `drizzle-kit migrate && node dist/server.js` — **a migration do banco acontece sozinha, a cada deploy, antes do servidor subir**. Não existe passo manual de "lembrar de rodar a migration" em produção.

`drizzle.config.ts` tem uma nota explícita no código sobre isso: não usar a mesma função de limpeza de URL de conexão que o cliente de runtime usa, porque isso travaria o `drizzle-kit migrate` do deploy silenciosamente (sem erro, só preso em "applying migrations..." até o Railway desistir).

**`apps/backend/package.json` tem `engines.node` fixado em `20.x`, e isso é obrigatório, não cosmético.** Sem esse pin, o Railpack (builder do Railway) escolhe sozinho uma versão de Node (viu-se ele escolher 22.23.1) cujo npm embutido tem um bug conhecido do arborist (`Cannot read properties of null (reading 'edgesOut')`) que derruba o `npm install` inteiro assim que o `package-lock.json` muda de uma certa forma — mesmo lockfile que instala normalmente com CI (Node 20, `npm ci`) e localmente (Node 24, `npm ci`/`npm install`). Sintoma em produção: dois deploys seguidos falham no passo de build (Railway mantém servindo a última versão com deploy bem-sucedido, silenciosamente — sem esse doc, é fácil achar que o código foi ao ar só porque o `git push`/CI passaram). Sempre que mexer em `apps/backend/package.json` (dependência nova, engines, etc.), depois do push vale conferir `railway status` (deployment ativo bate com o commit mais recente?) — não basta o CI verde.

## Frontends — Vercel, um projeto por app

`apps/worker`, `apps/business` e `apps/admin` são deployados como **3 projetos Vercel separados**, cada um apontando pro mesmo repositório com Root Directory configurado pra `apps/<nome>`. Deploy automático a cada push, cada app com seu próprio domínio.

## CI

Ver [`04-development/conventions.md`](../04-development/conventions.md#ci) — `backend-ci.yml` e `frontend-ci.yml` rodam lint/typecheck/test/build em cada PR, mas **não fazem o deploy em si** — isso é feito pela integração nativa Railway/Vercel com o GitHub, fora do GitHub Actions.

## Migrations em produção

Geradas localmente (`npm run db:generate`, ver getting-started), commitadas no repositório (`apps/backend/migrations/*.sql`), e aplicadas automaticamente no boot de cada deploy do backend. Não há passo manual — mas mudanças de schema que envolvam rename de coluna ambíguo pedem confirmação interativa do `drizzle-kit` ao gerar a migration localmente (não em produção, onde já vem resolvida no arquivo `.sql` gerado).
