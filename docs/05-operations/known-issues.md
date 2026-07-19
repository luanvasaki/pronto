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
- **Skip de avaliação só existe pro lado da empresa** — `apps/backend/src/modules/ratings/skip-company-rating.ts`. Não há `skip-worker-rating` equivalente; se o trabalhador não quiser avaliar, o registro fica pendente pra sempre.
- **Verificação de telefone nunca implementada** — `apps/backend/src/db/schema/users.ts` (`phone`, `phoneVerifiedAt`), reservado pra uma fase futura que nunca chegou.
- **Sem upload de documento de verificação pra empresa pessoa jurídica (CNPJ)** — confirmado por grep em `apps/business/src/app/cadastro/page.tsx:35,164-183`: `uploadCompanyDocument` só é chamado no ramo de pessoa física. Não ficou claro em que a verificação de CNPJ se baseia hoje.
- **Sem CTA pra corrigir verificação de empresa recusada** — `apps/business/src/app/(app)/perfil/page.tsx:39`: mostra "Verificação recusada" mas não tem link/ação pra reenviar documento ou ver o motivo.
- **`/vagas/nova` não bloqueia publicar com empresa não verificada**, só avisa — `apps/business/src/app/(app)/vagas/nova/page.tsx:246-254`. Usuário só descobre a recusa depois do submit no backend.

## Código morto confirmado (grep, sem escritor/consumidor em produção)

- `apps/business/src/components/ui/growth-chart.tsx` (+ teste) — órfão desde a extração do painel admin pro app `apps/admin` (commit `8a90d27`); ninguém importa. Duplicado (não compartilhado) por uma cópia idêntica em `apps/admin/src/components/ui/growth-chart.tsx`, que essa sim é usada.
- `shifts.checkInLat/checkInLng/checkOutLat/checkOutLng` — `apps/backend/src/modules/shifts/shift-response.ts:13-18,31-36` e `apps/backend/src/db/schema/shifts.ts:47-48,56-57`. Nunca mais escritas desde a remoção de geolocalização do check-in/check-out; continuam expostas na resposta da API sempre `null`.
- `worker_profiles.totalShiftsCompleted`/`totalNoShows` — `apps/backend/src/db/schema/worker-profiles.ts:87-92` (comentário explícito no schema chamando as colunas de "mortas"). Recalculadas ao vivo em `get-worker-profile.ts:78-115`.
- `companies.totalJobsPosted` — `apps/backend/src/db/schema/companies.ts:76`; confirmado morto também em `apps/backend/src/modules/admin/list-companies.ts:23-24` e `apps/backend/src/modules/companies/get-company-profile.ts:44-46`.
- `shift_status.no_show`, `payment_status.refunded` — ver seção de funcionalidades inacabadas acima.

## Inconsistências

- **`isValidPassword` diverge entre `packages/shared` e o backend** — `packages/shared/src/password.ts:4-6` só valida `length >= 8`; `apps/backend/src/modules/auth/password.ts:4-11` também valida `<= 72` (porque bcrypt trunca silenciosamente depois do byte 72). Um usuário pode digitar uma senha de 100 caracteres, passar na validação do front, e só descobrir o erro depois do round-trip ao backend.
- **`use-require-auth.ts` divergiu entre worker e business** — `apps/worker/src/hooks/use-require-auth.ts:22-33` desloga em **qualquer** erro (rede instável, timeout, 500); `apps/business/src/hooks/use-require-auth.ts` foi corrigido pra só deslogar em 401 real. O comentário do worker ainda afirma "mesma checagem usada pelo app business", o que não é mais verdade — o fix não foi retroportado.
- **Checagem de menor de idade duplicada em ~5 lugares** no backend com a mesma fórmula (`calculateAge(...) < 18`), sem um helper único — `create-application.ts:57`, `update-application-status.ts:77-78`, `update-job.ts:64-66`, `get-job-detail.ts:66`, `list-nearby-jobs.ts:59`. Risco de divergência se a regra de maioridade mudar.
- **Duplo significado de `applications.status = 'rejected'`** — usado tanto pra rejeição comum quanto pra "aprovação desfeita" (distinguido só por `removedAt`). Decisão deliberada, mas exige sempre checar os dois campos juntos.
- **README raiz desatualizado** — ainda descreve o painel admin como "dentro do app business" (já foi extraído pro `apps/admin`) e ainda fala em "roadmap de 90 dias, fase 1" (o produto já passou muito disso).
- **Design handoff (`design_handoff_pronto/`) descreve login por OTP de telefone**, nunca implementado — a autenticação real é e-mail/senha + Google. O handoff é referência visual desatualizada nesse ponto específico.
- **Comentário copiado sem adaptar** — `apps/admin/src/hooks/use-require-auth.ts:22-24` referencia rotas (`/painel`, `/vagas/nova`) que existem no app `business`, não no `admin` — sobrou de um copy-paste na extração do hook.

## Perguntas em aberto (não são bugs, são decisões pendentes de negócio/produto)

Ver [`01-business/roadmap.md`](../01-business/roadmap.md#perguntas-em-aberto-que-vieram-da-auditoria-técnica).
