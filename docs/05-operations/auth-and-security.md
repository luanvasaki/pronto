# Autenticação e segurança — Pronto

> Detalhe completo dos fluxos de auth. Visão resumida em [`03-architecture/backend-architecture.md`](../03-architecture/backend-architecture.md). Corridas e bugs históricos específicos de auth em [`04-development/knowledge.md`](../04-development/knowledge.md).

## Sessão

Dois cookies **httpOnly**: um access token (JWT HS256, 15 minutos de validade) e um refresh token opaco (30 dias, guardado no banco só como hash SHA-256, nunca em texto puro). O cookie é a via principal de autenticação; um header `Bearer` funciona como alternativa, útil pra automação/teste.

`sameSite` é `lax` em desenvolvimento e `none` em produção — necessário porque frontend e backend rodam em domínios diferentes em produção. Há histórico de bug de login instável ligado a essa configuração (ver [`04-development/knowledge.md`](../04-development/knowledge.md)); qualquer mudança aqui merece cautela extra.

## Fluxos

- **Registro por senha**: e-mail + senha (bcrypt, 12 salt rounds). O aceite de termos **não** acontece mais na criação da conta — foi movido pra tela cheia `/cadastro/termos`, ver seção "Termos de uso e aceite auditável" abaixo.
- **Login por senha**: usa um hash dummy pré-computado quando o e-mail não existe, especificamente pra igualar o tempo de resposta e dificultar enumeração de contas por medição de tempo.
- **Login com Google**: verifica o ID token direto contra as chaves públicas do Google (sem client secret). **Não linka automaticamente** uma conta Google a uma conta de senha pré-existente com o mesmo e-mail — decisão deliberada pra evitar tomada de conta (account takeover).
- **Refresh de sessão**: rotação de token com **detecção de reuso** — se o token apresentado já foi revogado antes, todas as sessões daquele usuário são revogadas na hora, como sinal de token roubado.
- **Esqueci minha senha / redefinir senha**: sempre responde com a mesma mensagem, exista ou não o e-mail (anti-enumeração). Token opaco, hash SHA-256, validade de 1 hora, uso único.
- **Trocar senha logado**: exige a senha atual, rejeita contas só-Google (sem `passwordHash`), revoga as outras sessões ativas mas mantém a sessão atual válida com tokens novos.
- **Logout**: idempotente — funciona mesmo chamado duas vezes ou numa sessão já expirada.
- **Verificação de telefone**: schema existe (`users.phone`, `phoneVerifiedAt`) mas **nunca foi implementada** — não é um fluxo ativo hoje.

## Termos de uso e aceite auditável

Documentos legais versionados vivem em `consent_documents` (`type`: `platform_terms`, `minors_opportunity`, `login_summary`) — nunca mais uma frase solta embutida em componente. Nova versão nunca faz UPDATE numa linha existente, sempre insere uma nova (histórico completo preservado, requisito explícito do texto jurídico, seção 12.5). Servidos publicamente (sem auth) por `GET /consent-documents/:type`, porque o texto vigente precisa ficar acessível fora de qualquer contexto autenticado.

Todo aceite grava **versão + timestamp + IP (`req.ip`) + user-agent** — nunca um boolean solto — em quatro lugares independentes:

- `users.termsAcceptedAt`/`termsVersion`/`termsIpAddress`/`termsUserAgent`: aceite do documento completo (12 capítulos, `platform_terms`) numa tela cheia (`/cadastro/termos`, estilo "ler o documento inteiro antes de avançar"), depois de criar a conta e antes do formulário de perfil. `PUT /auth/accept-terms` (autenticado) valida que a versão enviada bate com a mais recente antes de gravar.
- `login_consents` (uma linha por `userId`+`version`): "Termo Resumido de Ciência", um modal **bloqueante** mostrado no app autenticado (não uma navegação de tela cheia) sempre que a versão vigente ainda não foi aceita — independente do aceite acima, mesmo pra quem acabou de aceitar o documento completo. `POST /auth/accept-login-terms`.
- `jobs.minorsTermsAcceptedAt`/`minorsTermsVersion`/`minorsTermsIpAddress`/`minorsTermsUserAgent`: aceite do termo `minors_opportunity`, exigido só quando a empresa liga `minorsAllowed` numa vaga — uma vez por vaga, não a cada edição.
- `applications.termsIpAddress`/`termsUserAgent` (+ `termsAcceptedAt`/`termsVersion` já existentes): aceite de um recorte (capítulos 3 e 6, não um documento novo) do `platform_terms`, mostrado num modal na hora de se candidatar.

**Nenhuma conta antiga é dispensada**: o gate de `(app)/layout.tsx` (worker e business) compara `users.termsVersion` com a versão vigente de `platform_terms` a cada carregamento — qualquer divergência (incluindo `null`, de quem nunca aceitou nada) redireciona pra `/cadastro/termos` antes de liberar o app, mesmo pra contas criadas antes desse sistema existir.

A antiga constante fixa `CURRENT_TERMS_VERSION` (`shared/terms-version.ts`) foi removida — todo lugar que grava uma versão de termos (`create-job`, `create-application`, `accept-terms`) lê a versão mais recente ao vivo de `consent_documents`.

O sistema disciplinar progressivo descrito no texto legal (advertência → suspensão 7/14/28 dias → bloqueio) **não tem enforcement real** — só o texto/aceite existem hoje; a penalização de verdade é decisão explícita de ficar pra uma tarefa futura separada (ver [`05-operations/known-issues.md`](./known-issues.md)).

Visibilidade pra prova em disputa: `GET /admin/companies`/`workers` devolvem o histórico de aceite (versão/data/IP dos três pontos acima) — sem endpoint de escrita novo, só leitura, renderizado colapsado nas páginas `/admin/empresas`/`/admin/trabalhadores` (componente `ConsentHistory`).

## Rate limiting

Ver [`03-architecture/backend-architecture.md`](../03-architecture/backend-architecture.md#rate-limiting-em-camadas) — geral, escrita, autenticação, e uma camada extra específica de login por conta (chaveada por e-mail, não só IP).

## Serviços com trava de segurança em produção

E-mail (`ConsoleEmailSender`) e verificação de token do Google (`UnconfiguredGoogleTokenVerifier`) têm fallback só em desenvolvimento — em produção, a ausência da env var correspondente **trava o boot da aplicação** em vez de degradar silenciosamente. Ver [`03-architecture/integrations.md`](../03-architecture/integrations.md) pro detalhe completo de cada integração.

## Proteção contra CSRF

Checagem de mesma origem aplicada globalmente, antes de qualquer rota, logo depois do parser de cookie/JSON — ver ordem de middlewares em [`03-architecture/backend-architecture.md`](../03-architecture/backend-architecture.md#montagem-da-aplicação).

## Documentos de KYC

Nunca servidos por URL direta do provedor de armazenamento — sempre através de um proxy autenticado que valida quem está pedindo antes de retornar o arquivo. Validação de tipo de arquivo é feita por assinatura real de bytes, não pelo `Content-Type` que o cliente declarou no upload.
