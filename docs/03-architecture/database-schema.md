# Schema do banco de dados — Pronto

> Postgres via Drizzle ORM (`drizzle-orm/node-postgres`). 19 tabelas, 16 enums, ~54 migrations até o momento desta documentação. Padrões gerais antes do detalhe tabela por tabela.

## Padrões gerais

- Toda tabela usa `uuid` como chave primária, `defaultRandom()`.
- Quase todas têm `createdAt`/`updatedAt` (`timestamp with time zone`).
- **A maioria das FKs de negócio não tem `onDelete: cascade`** — só relações de identidade têm (ex: `worker_profiles.userId` → `users.id` é cascade, porque é extensão da mesma pessoa; `jobs.companyId` não é, porque é registro de negócio, não identidade).
- Corridas (dois requests simultâneos tentando a mesma transição de estado) são resolvidas por **UPDATE condicional** (`WHERE status = 'X'`) em vez de lock explícito, em todo o sistema — é o padrão de concorrência do projeto inteiro, não um caso isolado.
- Vários enums cresceram organicamente via `ALTER TYPE ... ADD VALUE` em migrations separadas, refletindo evolução real do produto (não um planejamento perfeito desde o início) — por exemplo, `shifts.status` ganhou `checked_out` numa migration recente (a mudança de check-in/check-out sem geolocalização), e `documents.type` ganhou `cnh` e `guardian_identity` em migrations diferentes, conforme o KYC foi ficando mais completo.

## Tabelas

### `users`
Conta de login. `email` nullable (por conveniência de fixture de teste, não por regra de produto — na aplicação é obrigatório), `passwordHash` nullable (null = conta só-Google), `googleId`, `phone`/`phoneVerifiedAt` (reservados pra uma verificação por celular que nunca foi implementada), `status` (active/suspended/banned), `isAdmin` (só setado por update direto no banco). `termsAcceptedAt`/`termsVersion`/`termsIpAddress`/`termsUserAgent` — aceite do documento completo (`consent_documents.type = 'platform_terms'`) na tela `/cadastro/termos`, não mais na criação da conta (ver módulo `auth` e [`05-operations/auth-and-security.md`](../05-operations/auth-and-security.md)). Únicos: `phone`, `email`, `googleId`.

### `consent_documents`
Texto legal versionado (aceite auditável, seção 12.5 do termo consolidado — nunca uma frase solta embutida em componente). `type` (`platform_terms`/`minors_opportunity`/`login_summary`), `version` (varchar), `chapters` (jsonb: `{ number, heading, body }[]`), `declaration` (texto da declaração final). **Nunca dá UPDATE numa linha existente** — nova versão do texto é sempre uma linha nova, histórico completo preservado. Único: par (`type`, `version`). Seedado por `db/seed-consent-documents.ts` (idempotente, `npm run db:seed-consent-documents` — precisa ser rodado manualmente contra produção, o `vitest globalSetup` só cobre testes). Servido publicamente (sem auth) por `GET /consent-documents/:type`.

### `login_consents`
Aceite do "Termo Resumido de Ciência" no login — independente do aceite em `users.termsAcceptedAt`, roda uma vez por versão. `userId` (FK **sem** `onDelete: cascade` — é registro de auditoria, precisa sobreviver mesmo se a conta for excluída no futuro), `version`, `ipAddress`, `userAgent`, `acceptedAt`. Único: par (`userId`, `version`).

### `worker_profiles`
Extensão 1:1 de `users` (`userId` é PK e FK, cascade). Dados pessoais, `birthDate` (decide bloqueio de menor de 16 e exigência de responsável pra 16-17), campos de responsável, `homeLat/Lng` + `homeAddressLabel` (público) vs. `homeAddressFull` (privado, nunca exposto pra empresa), `searchRadiusKm` (default 10), `kycStatus`, `avgRating`/`avgCategoryScores`. "Horas de voo" (turnos concluídos, horas trabalhadas, etc.) são sempre recalculadas ao vivo a partir de `shifts` — não existe coluna acumulada pra isso. Único: `cpf`.

### `companies`
`ownerUserId` único (modelo mono-dono deliberado — um usuário só por empresa hoje). `personType` (jurídica/física) decide se `cnpj` ou `cpf` está preenchido. `businessSegment` (bar/restaurante/buffet/hotel/eventos/casa_noturna/outro). `verificationStatus`, `rejectionReason` (texto livre do admin, só preenchido quando `rejected`; limpo no reenvio de documento). Vagas publicadas são sempre contadas ao vivo (`count(*)` em `jobs`) — não existe coluna acumulada pra isso. `isDemo` marca dados de demonstração removíveis em lote pelo admin.

### `company_documents`
Documento de identidade de empresa pessoa física. Sem cascade próprio — a decisão de verificação é sobre a empresa inteira.

### `cnh`
Só o enum `cnh_category` (A/B/AB/C/D/E), compartilhado entre `worker_profiles` e `jobs`.

### `skill_categories`
Deliberadamente plana (sem hierarquia) — decisão de manter simples até haver demanda real por categorias aninhadas. `status` (approved/pending/rejected, default **approved** pra não quebrar a migração das categorias fixas originais). Qualquer usuário pode criar sob demanda. Único: `lower(name)` — case-insensitive de propósito, pra "Manobrista" e "manobrista" criadas em corrida não virarem duas categorias.

### `jobs`
A vaga/escala. Sem cascade em `companyId`/`categoryId` — é registro de negócio, não identidade. Campos de exigência (`requiresExperience`, `cnhCategory`/`cnhRequired`, `minorsAllowed`), benefícios (`mealProvision`/`transportProvision`: none/on_site/paid + valor), `positionsTotal`/`positionsFilled`, `payAmount`, datas (`startsAt`/`endsAt`/`applicationsCloseAt`), `termsAcceptedAt`/`termsVersion`/`termsIpAddress`/`termsUserAgent` **por vaga** (não só no cadastro — respaldo jurídico repetido a cada publicação; versão sempre lida ao vivo de `consent_documents.type = 'platform_terms'`, não uma constante fixa). `minorsTermsAcceptedAt`/`minorsTermsVersion`/`minorsTermsIpAddress`/`minorsTermsUserAgent` — aceite específico do termo `minors_opportunity`, exigido só quando `minorsAllowed: true`, gravado uma vez (edições seguintes não pedem de novo se já preenchido). `status` (open/filled/cancelled). `addressLabel` (texto, monta-se no front a partir de CEP/rua/número/complemento/bairro/cidade/UF via `AddressFields`) + `locationLat`/`locationLng` (`doublePrecision`, ambos `.notNull()`) — populados por geocodificação automática do endereço (Nominatim, `POST /jobs/geocode-address`), com "usar minha localização atual" (GPS do dispositivo) como ajuste fino opcional, não obrigatório.

### `job_announcements`
Avisos da empresa numa vaga. Sem cascade, sem coluna de autor (implícito pelo `jobId` — só o dono publica).

### `job_questions`
Pergunta pública + resposta. `answer`/`answeredAt` nulos = ainda não respondida.

### `applications`
Candidatura. `status` (pending/approved/rejected/withdrawn). `removedAt`/`workerSeenRemovalAt` distinguem "aprovação desfeita" de rejeição comum, mesmo status (`rejected`) usado pros dois casos — ver nota em [`02-product/glossary.md`](../02-product/glossary.md). `termsAcceptedAt`/`termsVersion`/`termsIpAddress`/`termsUserAgent` — aceite do recorte de capítulos (3 e 6) do `platform_terms`, mostrado num modal na hora de se candidatar. Único: par (`jobId`, `workerId`) — não candidata duas vezes à mesma vaga.

### `shifts`
Nasce de uma candidatura aprovada — não existe tabela de convite separada. `jobId`/`workerId` são denormalizados de `applicationId` só pra leitura rápida, não são segunda fonte de verdade. `status` (scheduled/checked_in/checked_out/completed/no_show/cancelled — `checked_out` foi inserido no meio do enum numa migration recente). `payAmountSnapshot` congela o valor no momento da aprovação. `checkInAt`/`checkOutAt` (ação do trabalhador) separados de `checkInConfirmedAt`/`checkOutConfirmedAt` (confirmação da empresa, independentes entre si) — sem coordenadas de geolocalização (removidas do check-in/check-out, colunas dropadas na migration `0049`). `companyRatingSkippedAt`/`workerRatingSkippedAt` (ver módulo `ratings`). Único: `applicationId`.

### `ratings`
Quem foi avaliado é sempre "a outra ponta do mesmo turno" — não é uma coluna própria. `raterRole` (worker/company). `score` (1-5, com CHECK constraint no banco). `categoryScores` (jsonb). Sem `updatedAt` — é registro permanente, não editável. Único: par (`shiftId`, `raterRole`).

### `payments`
Campos mínimos, porque um split de verdade seria feito por um PSP, não por um ledger próprio. `status` (pending/charged/released/confirmed/disputed/failed/refunded). Hoje, `charged`/`released`/`confirmed`/`disputed`/`failed` são os únicos estados realmente alcançados em produção — `refunded` nunca é escrito (ver [`05-operations/known-issues.md`](../05-operations/known-issues.md)). Único: `shiftId`.

### `documents`
Documento de KYC do trabalhador (a empresa não tem upload equivalente hoje, exceto pessoa física via `company_documents`). Cascade (é extensão de identidade). `type` (identity/selfie/cnh/guardian_identity — os dois últimos adicionados em migrations posteriores, conforme o KYC evoluiu). `status`, `reviewedBy`/`reviewedAt`, `rejectionReason` (texto livre do admin, só preenchido quando `rejected`; reenvio nunca atualiza a linha antiga, então o motivo do documento anterior fica preservado no histórico).

### `refresh_tokens`
Só o hash do token (nunca o valor em texto puro), `expiresAt`, `revokedAt`. Cascade. Único: `tokenHash`.

### `password_reset_tokens`
Mesmo padrão de `refresh_tokens`, mas com `usedAt` (uso único, sem lógica de "reuso indica roubo" — essa lógica é só do refresh token).

### `push_subscriptions`
Uma linha por dispositivo/navegador, não por usuário (a mesma pessoa pode ter várias). Cascade. Único: `endpoint` (permite upsert natural quando o navegador rotaciona o endpoint).

### `worker_skills`
N:N entre trabalhador e categoria. Cascade em `workerId`, sem cascade em `categoryId`. `hasExperience` é autodeclarado pelo trabalhador. Único: par (`workerId`, `categoryId`).

## Enums

`user_status`, `kyc_status`, `company_verification_status`, `company_person_type`, `business_segment`, `skill_category_status`, `job_status`, `benefit_provision`, `cnh_category`, `application_status`, `shift_status`, `rater_role`, `payment_status`, `document_status`, `document_type`, `consent_document_type` (`platform_terms`/`minors_opportunity`/`login_summary`).

## Colunas mortas conhecidas

`worker_profiles.totalShiftsCompleted`/`totalNoShows`, `companies.totalJobsPosted` e `shifts.checkInLat/checkInLng/checkOutLat/checkOutLng` — confirmadas via grep como nunca escritas em produção — foram removidas de verdade (migration `0049`), não só documentadas como mortas.

Ainda existem, por decisão consciente (não são "sujeira", são estado modelado pra um caso que ainda não acontece):

- Enum values nunca escritos: `shift_status.no_show`, `payment_status.refunded` — ver [`05-operations/known-issues.md`](../05-operations/known-issues.md).
