# Documentação — Pronto

Documentação em 3 camadas, construída a partir de auditoria completa de engenharia reversa do código + discussão estratégica de produto. Ver regra permanente: **toda mudança no projeto precisa atualizar a documentação correspondente, na mesma tarefa.**

## Camada 1 — Visão geral (onboarding)

- [`00-vision/vision.md`](./00-vision/vision.md) — missão, o problema real, filosofia
- [`00-vision/principles.md`](./00-vision/principles.md) — princípios operacionais, o que nunca vamos fazer/sacrificar
- [`03-architecture/overview.md`](./03-architecture/overview.md) — os 4 apps, o monorepo, o padrão de módulo
- [`02-product/user-journey.md`](./02-product/user-journey.md) — jornada completa de cada persona
- [`04-development/getting-started.md`](./04-development/getting-started.md) — rodar o projeto localmente
- [`05-operations/deployment.md`](./05-operations/deployment.md) — Railway, Vercel, CI

## Camada 2 — Domínio e dados

- [`03-architecture/database-schema.md`](./03-architecture/database-schema.md) — schema completo
- [`05-operations/auth-and-security.md`](./05-operations/auth-and-security.md) — autenticação e segurança
- [`06-reference/backend-modules/jobs.md`](./06-reference/backend-modules/jobs.md) + [`applications.md`](./06-reference/backend-modules/applications.md) — vagas e candidaturas
- [`06-reference/backend-modules/shifts.md`](./06-reference/backend-modules/shifts.md) + [`payments.md`](./06-reference/backend-modules/payments.md) + [`ratings.md`](./06-reference/backend-modules/ratings.md) — turno, dinheiro, avaliação
- [`06-reference/backend-modules/workers.md`](./06-reference/backend-modules/workers.md) + [`companies.md`](./06-reference/backend-modules/companies.md) — perfis e verificação
- [`03-architecture/integrations.md`](./03-architecture/integrations.md) — o que é real vs. mock

## Camada 3 — Referência técnica

- [`06-reference/backend-modules/`](./06-reference/backend-modules/) — um arquivo por módulo do backend
- [`06-reference/frontend-routes/`](./06-reference/frontend-routes/) — mapa de telas de worker, business, admin
- [`06-reference/shared-package.md`](./06-reference/shared-package.md) — inventário de `@shift/shared`
- [`05-operations/known-issues.md`](./05-operations/known-issues.md) — backlog técnico vivo (dívidas, código morto, inconsistências)
- [`05-operations/ux-findings.md`](./05-operations/ux-findings.md) — achados de UX (varredura inicial da Skill `ux-designer`)

## Negócio e produto

- [`01-business/`](./01-business/) — visão de negócio, marketplace, monetização, roadmap
- [`02-product/`](./02-product/) — jornada, funcionalidades, glossário
- [`04-development/`](./04-development/) — convenções e conhecimento tribal

## Equipe e processo

- [`04-development/team-workflow.md`](./04-development/team-workflow.md) — as 7 especialidades permanentes do projeto (Skills em `.claude/skills/`), como colaboram, fluxos e hierarquia de interrupção
