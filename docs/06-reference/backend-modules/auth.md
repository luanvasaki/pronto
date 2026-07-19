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

Detalhe de cada fluxo, mitigação de enumeração, detecção de reuso de refresh token: ver [`05-operations/auth-and-security.md`](../../05-operations/auth-and-security.md).
