# Pronto

Marketplace de contratação de freelancers sob demanda — conecta empresas (bares, restaurantes, buffets, eventos, hotéis) que precisam de staff temporário em poucas horas com trabalhadores disponíveis.

## Estrutura

```
apps/
  backend/    API (Node.js + TypeScript)
  worker/     PWA do trabalhador (Next.js) — instalável via navegador, sem loja de app
  business/   PWA da empresa + painel admin (Next.js) — também instalável via navegador
packages/
  shared/     Tipos TypeScript compartilhados entre os três apps acima
```

Nenhum dos dois frontends é um app nativo (React Native/Expo) — ambos são PWAs para evitar custo e fila de revisão de loja de app nesta fase.

## Banco de dados local

Este projeto usa Postgres 16 via Homebrew, rodando na **porta 5433** (não 5432 — nesta máquina já existia outro Postgres do sistema ocupando a porta padrão; ajuste `scripts/setup-local-db.sh` e o `DATABASE_URL` se a sua for diferente).

Setup de máquina (uma vez só):

```bash
brew install postgresql@16
brew services start postgresql@16
```

Se a porta 5432 já estiver ocupada no seu sistema, edite `port` em
`$(brew --prefix)/var/postgresql@16/postgresql.conf` antes de iniciar o serviço.

Setup do projeto (idempotente, pode rodar de novo sem medo):

```bash
./scripts/setup-local-db.sh
```

Isso cria a role `shift` e o banco `shift_dev`. A string de conexão já está em `apps/backend/.env.example`.

## Status

Em desenvolvimento inicial seguindo o roadmap de 90 dias (fase 1: fundação e modelagem).
