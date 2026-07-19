# Convenções — Pronto

> Como o código é escrito e testado neste projeto. Padrão de módulo do backend já descrito em [`03-architecture/overview.md`](../03-architecture/overview.md) — aqui é o resto.

## Cultura de comentário: explica o "por quê", nunca o "o quê"

Esse é o traço mais consistente do código do Pronto, backend e frontend: comentários **não descrevem o que o código faz** (isso já está no próprio código, bem nomeado) — eles registram a razão de uma decisão não óbvia, uma corrida resolvida, um bug histórico corrigido, ou uma limitação conhecida e aceita. Essa cultura de comentário foi, literalmente, a fonte primária de boa parte desta documentação — sem ela, decisões como "por que o UPDATE vem antes da chamada ao gateway" ou "por que `no_show` nunca é escrito" teriam que ser adivinhadas.

**Ao escrever código novo neste projeto, mantenha esse padrão**: se uma linha de código já explica o que ela faz pelo nome das variáveis/funções, não comente o óbvio. Comente quando alguém lendo o código do zero, sem contexto de reunião ou de Slack, iria se perguntar "por que assim e não do outro jeito".

## Testes de backend

- Cada arquivo de teste usa **fixtures únicas** (telefone, e-mail, CNPJ, nome de categoria) que não colidem com outros arquivos de teste — comentário padrão em quase todo arquivo: "Fixtures únicas entre arquivos de teste (ver README)".
- Testes batem no Postgres de verdade (não mockam o banco), com limpeza explícita em `afterEach` — inserir e depois deletar os dados criados, respeitando a ordem de foreign keys manualmente (não há cascade de negócio, então a ordem de delete importa).
- Setup de cenário complexo (ex: turno concluído, pagamento liberado) é feito chamando as próprias funções de domínio em sequência (ex: `checkIn` → `checkOut` → `confirmCheckOut`), não inserindo direto no banco — isso garante que o teste também valida que o caminho real de chegar naquele estado funciona.
- Onde o Drizzle não tem `relations()` configurado, joins são feitos em memória (buscar uma lista, depois buscar os relacionados por `inArray`, e juntar em JS) — isso é um padrão recorrente no código de produção também, não só em teste, com o mesmo comentário reaparecendo em vários módulos.

## CI

Dois workflows, GitHub Actions:

- **`backend-ci.yml`** — dispara em PR que toca `apps/backend/**` (ou `package.json`/`package-lock.json`) e em push pra `main`. Sobe um container Postgres 16 efêmero via `services`, roda `npm ci` → lint → typecheck → `db:migrate` (contra o Postgres do CI) → `test` → `build`, nessa ordem.
- **`frontend-ci.yml`** — 4 jobs paralelos e independentes (`shared`, `business`, `worker`, `admin`), cada um com lint + typecheck + test + build (`shared` não builda, só é verificado). Decisão deliberada: `business`/`worker`/`admin` rodam mesmo se `shared` quebrar — o objetivo é pegar o problema exatamente onde ele aparece de verdade pra quem consome o pacote, não esconder atrás de uma falha upstream.

## Git

Um commit por mudança lógica, sem squash automático — histórico do repositório é usado ativamente como fonte de contexto (inclusive nesta documentação, via `git log`).
