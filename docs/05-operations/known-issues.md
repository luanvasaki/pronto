# Backlog técnico conhecido — Pronto

> Tudo aqui veio da auditoria de engenharia reversa completa do código (não de suposição). Cada item tem arquivo:linha de onde foi confirmado. Isso é um documento vivo — ao resolver um item, mova pra um changelog ou remova; ao encontrar um novo, adicione aqui, na mesma tarefa que o encontrar (ver [`docs-must-stay-in-sync`](../00-vision/vision.md) na memória do projeto). Achados de qualidade de interface (não lógica) ficam em [`ux-findings.md`](./ux-findings.md), mantido pela Skill `ux-designer`.

## Dívidas técnicas (decisões conscientes, com trade-off real)

- **Gateway de pagamento 100% mock** — `apps/backend/src/modules/payments/create-payment-gateway.ts:15-17`, `payment-gateway.ts:15-21`. Decisão de produto documentada, mas é a maior lacuna funcional real do sistema. Ver [`01-business/monetization.md`](../01-business/monetization.md).
- **Busca de vagas por proximidade em memória**, sem índice geoespacial — `apps/backend/src/modules/jobs/list-nearby-jobs.ts:29-32`. Comentário explícito assumindo que não escala indefinidamente.
- **JWT com segredo único (HS256)** — `apps/backend/src/modules/auth/jwt.ts:11-16`. Assumido como ponto a revisitar se o backend deixar de ser um processo só.
- **`companies.ownerUserId` único** — `apps/backend/src/db/schema/companies.ts:41-42`. Mono-dono deliberado; multiusuário por empresa exigiria nova modelagem quando houver demanda.
- **Falhas de pagamento sem retry/fila automática** — `apps/backend/src/modules/admin/list-failed-payments.ts:14-20`. Resolução hoje é 100% manual pelo admin.

## Funcionalidades inacabadas (implementação parcial, por decisão consciente)

- **`no_show` nunca é escrito** — confirmado em `apps/backend/src/modules/companies/get-live-event-status.ts:41-46` (comentário explícito: "não existe (nem precisa existir) nenhum job/cron marcando falta"), e também em `get-company-worker-history.ts:57`, `get-worker-profile.ts:83`, `get-metrics.ts:70` (todos só leem, nunca escrevem). Consequência prática: métricas de "confiabilidade"/"comparecimento" do trabalhador nunca descontam falta real hoje.
- **`payment.status = 'disputed'` sem fluxo de resolução** — sem endpoint ou processo de mediação depois que o trabalhador contesta um pagamento. Torna-se mais urgente quando o pagamento passar a ser processado de verdade (ver [`01-business/monetization.md`](../01-business/monetization.md)).
- **`refunded` nunca é atingido** — enum existe (`payments.ts` schema), zero escritas em código de produção.
- **Verificação de telefone nunca implementada** — `apps/backend/src/db/schema/users.ts` (`phone`, `phoneVerifiedAt`), reservado pra uma fase futura que nunca chegou.

## Código morto confirmado (grep, sem escritor/consumidor em produção)

- `shift_status.no_show`, `payment_status.refunded` — enum values nunca escritos em produção, ver seção de funcionalidades inacabadas acima. Diferente das colunas mortas já removidas (ver [`03-architecture/database-schema.md`](../03-architecture/database-schema.md#colunas-mortas-conhecidas)), esses ficam: são estado modelado pra um caso que ainda não acontece, não sujeira de coluna nunca usada.

## Inconsistências

- **Duplo significado de `applications.status = 'rejected'`** — usado tanto pra rejeição comum quanto pra "aprovação desfeita" (distinguido só por `removedAt`). Decisão deliberada, mas exige sempre checar os dois campos juntos.
- **Design handoff (`design_handoff_pronto/`) descreve login por OTP de telefone**, nunca implementado — a autenticação real é e-mail/senha + Google. O handoff é referência visual desatualizada nesse ponto específico.

## Perguntas em aberto (não são bugs, são decisões pendentes de negócio/produto)

Ver [`01-business/roadmap.md`](../01-business/roadmap.md#perguntas-em-aberto-que-vieram-da-auditoria-técnica).
