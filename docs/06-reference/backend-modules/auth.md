# Módulo `auth` — referência

> Fluxos completos e decisões de segurança em [`05-operations/auth-and-security.md`](../../05-operations/auth-and-security.md). Aqui é só o contrato de rotas.

## Rotas (`auth.routes.ts`)

| Rota | Rate limit extra | Função |
|---|---|---|
| `POST /auth/register` | auth (20/15min) | Criar conta por e-mail/senha |
| `POST /auth/login` | auth + login-por-conta (10/15min por e-mail) | Login por senha |
| `POST /auth/google` | auth | Login/registro via Google ID token |
| `POST /auth/refresh` | — | Rotaciona a sessão |
| `POST /auth/logout` | — | Encerra a sessão (idempotente) |
| `POST /auth/forgot-password` | auth | Dispara e-mail de reset (sempre "sucesso") |
| `POST /auth/reset-password` | auth | Efetiva o reset com token |
| `POST /auth/change-password` | requireAuth | Troca senha logado |
| `GET /auth/me` | requireAuth | Dados do usuário atual (inclui `isAdmin`) |
| `PUT /auth/accept-terms` | requireAuth | Aceita o documento completo (`platform_terms`) na tela `/cadastro/termos` — grava versão/IP/user-agent |
| `POST /auth/accept-login-terms` | requireAuth | Aceita o "Termo Resumido de Ciência" (`login_summary`) no modal bloqueante de login, uma vez por versão |

Detalhe de cada fluxo, mitigação de enumeração, detecção de reuso de refresh token, e o sistema completo de aceite auditável de termos: ver [`05-operations/auth-and-security.md`](../../05-operations/auth-and-security.md).

Rota pública auxiliar (fora de `auth.routes.ts`, em `consent-documents.routes.ts`): `GET /consent-documents/:type` (`platform_terms`/`minors_opportunity`/`login_summary`) — sem auth, devolve a versão mais recente do texto.
