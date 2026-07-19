# Arquitetura do backend — Pronto

> Como o Express é montado, decisões estruturais notáveis, e o padrão de concorrência usado em todo o sistema. Padrão de módulo (verbo.ts + controller + routes) já descrito em [`overview.md`](./overview.md). Fluxo de autenticação em detalhe: [`05-operations/auth-and-security.md`](../05-operations/auth-and-security.md).

## Montagem da aplicação

`createApp(options)` é uma **factory**, não um singleton de módulo — isso existe deliberadamente pra permitir que os testes chamem `createApp()` repetidamente com estado limpo, e pra injetar dublês de dependências externas (`EmailSender`, `GoogleTokenVerifier`, gateway de pagamento) via `CreateAppOptions`. `server.ts` só importa `createApp()`, sobe o listener, e inicializa o Sentry **antes** de montar as rotas, pra capturar erro mesmo na própria montagem.

Ordem de middlewares (fixa, sempre nessa sequência):

1. `trust proxy` — só em produção (Railway fica atrás de um proxy único).
2. CORS (origem vem de env var, com credentials habilitado).
3. Parser de cookie.
4. Parser de JSON.
5. Checagem de mesma origem (proteção CSRF).
6. Rate limiter geral (300 req/15min por IP).
7. Estático de `/uploads/public` — só quando o storage local é usado (sem token de Blob configurado).
8. Rotas de todos os módulos.
9. `notFoundHandler` → `errorHandler`, sempre por último, nessa ordem.

## Injeção de dependência pra serviços externos trocáveis

Onde uma rota depende de algo que precisa ser mockável em teste e configurável em produção (envio de e-mail, verificação de token do Google, gateway de pagamento), o módulo usa uma fábrica: `create<X>Routes(options)` ou `create<X>Handler(dependência)`. Isso evita instanciar o serviço real dentro do módulo de rota, e permite trocar por um dublê nos testes sem tocar no código de produção.

## O padrão de concorrência do projeto: UPDATE condicional

Toda corrida identificada no sistema — dois check-ins simultâneos, aprovar a mesma candidatura duas vezes, liberar um pagamento duas vezes, confirmar um recebimento duas vezes — é resolvida da mesma forma: um `UPDATE ... WHERE status = 'estado_esperado'` que só afeta uma linha se o estado ainda for o esperado no momento exato da escrita. A segunda tentativa simultânea simplesmente não encontra linha pra atualizar e falha de forma limpa, sem precisar de lock explícito no banco.

Isso é consistente o suficiente pra ser considerado o padrão de concorrência oficial do projeto — qualquer nova transição de estado que possa sofrer corrida deveria seguir a mesma receita.

## Banco de dados

Pool `pg` único, `drizzle(pool, { schema })` como singleton exportado (`db`). SSL é decidido **por hostname**, não por `NODE_ENV`: qualquer host que não seja `localhost`/`127.0.0.1` conecta com SSL obrigatório e verificação de certificado — decisão deliberada pra não depender de alguém lembrar de configurar a env var certa em cada ambiente.

`drizzle.config.ts` **não** usa a mesma função de limpeza de URL que o cliente de runtime usa — isso é proposital: usar lá travaria `drizzle-kit migrate` no deploy (Railway) tentando conexão sem TLS num Postgres gerenciado que exige SSL, sem nenhum erro visível, só preso em "applying migrations..." pra sempre.

`npm start` em produção roda `drizzle-kit migrate && node dist/server.js` — a migration do banco acontece sozinha a cada deploy, antes do processo subir.

## Rate limiting em camadas

- **Geral**: 300 requisições / 15 min por IP, aplicado globalmente.
- **Escrita**: 60 / 15 min, aplicado nas rotas que alteram estado.
- **Autenticação**: 20 / 15 min, na maioria das rotas de auth.
- **Login por conta**: 10 / 15 min, chaveado pelo e-mail normalizado (cai pro IP se não vier e-mail) — empilhado especificamente em `/auth/login`, em cima do rate limit geral de auth. Defesa em duas camadas contra IP rotativo.

## Push notifications

Implementação real (VAPID / `web-push`), não um mock — mas com o mesmo padrão dos outros serviços opcionais: sem as chaves configuradas, vira no-op silencioso em vez de erro. Limpa automaticamente inscrições que o navegador já revogou (resposta 404/410 do endpoint de push).

## Decisões arquiteturais notáveis, resumidas

Ver texto completo de cada uma nos módulos relevantes:

- JWT com segredo único (HS256) — assumido como ponto a revisitar se o backend deixar de ser um processo só.
- `companies.ownerUserId` único — mono-dono deliberado até haver demanda por múltiplos usuários por empresa.
- `skill_categories` deliberadamente sem hierarquia.
- Busca de vagas por proximidade calculada em memória (Haversine em JavaScript), sem índice geoespacial no banco — assumido não escalar indefinidamente, revisar quando o volume justificar.
