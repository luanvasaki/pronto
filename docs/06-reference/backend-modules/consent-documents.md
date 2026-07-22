# Módulo `consent-documents` — referência

> Armazenamento versionado do texto legal por trás de todo o sistema de aceite auditável. Fluxo completo de quando/onde cada aceite acontece: [`05-operations/auth-and-security.md`](../../05-operations/auth-and-security.md#termos-de-uso-e-aceite-auditável). Schema: [`03-architecture/database-schema.md`](../../03-architecture/database-schema.md#consent_documents).

## Rotas (`consent-documents.routes.ts`)

| Rota | Auth | Função |
|---|---|---|
| `GET /consent-documents/:type` | Nenhuma | Devolve a versão mais recente (`chapters` + `declaration` + `version`) de `platform_terms`/`minors_opportunity`/`login_summary` |

Sem auth de propósito: o texto vigente precisa ficar acessível fora de qualquer contexto autenticado, e o modal de candidatura/menores é aberto a partir de telas que já têm outro contexto de auth (mais simples devolver o documento solto do que herdar sessão).

## Comportamento

`getLatestConsentDocument(type)` (`get-consent-document.ts`) — pega a linha de maior `version`/`createdAt` pro `type` pedido, lança 404 se não existir nenhuma. Usado tanto pelo endpoint público quanto internamente por `auth`/`jobs`/`applications` (accept-terms, create-job, update-job, create-application) pra sempre gravar a versão vigente de verdade, nunca uma constante fixa.

Uma variante interna (`getLatestVersionOrNull`, usada por `get-consent-status.ts`) captura o 404 e devolve `null` — degradação graciosa: se ainda não existe nenhum documento seedado (ex: banco recém-migrado, antes do primeiro `db:seed-consent-documents`), o perfil do usuário simplesmente não exige aceite, em vez de quebrar o carregamento do app inteiro.

## Seed

`db/seed-consent-documents.ts` — idempotente (pula `(type, version)` já existente), roda via `npm run db:seed-consent-documents`. Precisa ser executado manualmente contra produção (Railway) depois do deploy; o `vitest globalSetup` (`test-global-setup.ts`) só garante que os testes tenham os documentos disponíveis, não substitui esse passo manual. O capítulo 12 do `platform_terms` seedado tem placeholders `[A PREENCHER]` (dados institucionais da entidade) — ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md#pendências-antes-de-produção-real).
