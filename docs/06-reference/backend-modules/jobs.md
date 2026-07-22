# Módulo `jobs` — referência

> Vaga/escala publicada por uma empresa. Vocabulário: [`02-product/glossary.md`](../../02-product/glossary.md). Schema: [`03-architecture/database-schema.md`](../../03-architecture/database-schema.md#jobs).

## Rotas (`jobs.routes.ts`, todas atrás de `requireAuth`, escrita com rate limit de 60/15min)

| Rota | Quem chama | Função |
|---|---|---|
| `POST /jobs` | Empresa | Cria vaga |
| `POST /jobs/duplicate-week` | Empresa | Duplica todas as vagas de uma semana pra outra |
| `GET /jobs/mine` | Empresa | Lista vagas da própria empresa |
| `GET /jobs/nearby` | Trabalhador | Vagas próximas, por raio de busca |
| `GET /jobs/:id` | Trabalhador | Detalhe de uma vaga |
| `PATCH /jobs/:id` | Empresa | Edita vaga aberta |
| `POST /jobs/:id/cancel` | Empresa | Cancela vaga |

## Regras de negócio

- **Criar vaga**: exige empresa com `verificationStatus = 'approved'` e aceite de termos naquela publicação específica (`termsAccepted`, exigido só na criação, não em cada edição; versão gravada é sempre a mais recente de `consent_documents.type = 'platform_terms'`, lida ao vivo). Quando `minorsAllowed: true`, exige também `minorsTermsAccepted` (400 sem isso) — grava `minorsTermsAcceptedAt`/`Version`/`IpAddress`/`UserAgent` a partir do termo `minors_opportunity`. `companyId` sempre vem do dono autenticado, nunca do corpo da requisição.
- **Validação de campos** (compartilhada entre criar e editar): `positionsTotal` inteiro ≥ 1, **sem limite superior**. Descrição mínima de 10 caracteres. Valores monetários (`payAmount`, `mealAmount`, `transportAmount`) validados por regex, maiores que zero. Benefícios seguem o padrão `none`/`on_site`/`paid`, com valor exigido só quando `paid`. CNH: `cnhRequired` só é `true` se `cnhCategory` também estiver preenchida; satisfação de categoria calculada considerando que `AB` cobre `A` e `B`. Datas: início no futuro, fim depois do início, prazo de candidatura (se informado) antes do início.
- **`applicationsCloseAt`**: se não informado, é calculado dinamicamente como 1h antes de `startsAt` — **não congelado na criação**, acompanha edições futuras do horário de início.
- **Cancelar vaga**: só permitido se nenhum turno estiver `checked_in`/`completed`. Numa única transação: marca a vaga `cancelled`, rejeita candidaturas pendentes, rejeita+marca como removidas as aprovadas, cancela os turnos agendados.
- **Editar vaga**: só enquanto `status = 'open'` (UPDATE condicional). Duas travas de regressão: não pode reduzir `positionsTotal` abaixo do já preenchido; não pode desmarcar `minorsAllowed` se já existe candidato aprovado menor de idade. Exige `minorsTermsAccepted` só na **primeira vez** que a vaga liga `minorsAllowed` (`needsMinorsTermsAcceptance = validated.minorsAllowed && !job.minorsTermsAcceptedAt`) — edições seguintes não pedem de novo se já aceito.
- **Duplicar semana**: pega todas as vagas não canceladas da semana de origem, desloca as datas pelo mesmo offset, e chama a mesma função de criar vaga pra cada uma (não insere direto) — reaproveita toda a validação. `positionsFilled` sempre reinicia em zero; candidaturas/turnos nunca são copiados. Um único aceite de termos (geral + menores, se aplicável) cobre o lote inteiro, não um por vaga duplicada.
- **Busca por proximidade** (`GET /jobs/nearby`): distância Haversine calculada em memória sobre todas as vagas abertas (ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md) sobre escala). Trabalhador menor de 18 anos só vê vagas com `minorsAllowed = true` — exclusão real da lista, não só aviso. Vagas somem da lista quando ficam cheias ou o prazo de candidatura vence.
- **Detalhe de vaga** (`GET /jobs/:id`): regra de acesso diferente da listagem — vaga não-aberta só é visível pra quem já se candidatou. `minorMismatch` aqui é só aviso, não esconde a vaga (diferente da listagem, que já filtra).
