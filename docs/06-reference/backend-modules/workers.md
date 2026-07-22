# Módulo `workers` — referência

> Perfil do trabalhador, KYC, documentos, reputação. Rotas em `worker-profile.routes.ts` e `worker-document.routes.ts`.

## Rotas

| Rota | Função |
|---|---|
| `GET /worker-profile/me` | Perfil próprio (com métricas calculadas ao vivo, mais `needsTermsAcceptance`/`hasAcceptedLoginTerms` — ver [`05-operations/auth-and-security.md`](../../05-operations/auth-and-security.md)) |
| `PUT /worker-profile` | Atualizar perfil |
| `GET /worker-profile/ratings` | Avaliações recebidas |
| `PATCH /worker-profile/location` | Atualizar localização (`homeLat/Lng`) |
| `PATCH /worker-profile/search-radius` | Atualizar raio de busca — endpoint **separado** de propósito, pra mudar o raio sem re-pedir permissão de GPS |
| `POST /worker-profile/photo` | Upload de foto de perfil |
| `POST /worker-profile/document` | Upload de documento de KYC |

## KYC

`kycStatus`: `pending` (default) → `approved`/`rejected` (só o módulo `admin` escreve esses dois). Reenviar documento depois de `rejected` volta o status pra `pending` automaticamente. Editar o perfil de um jeito que muda maior↔menor de idade também **força de volta pra `pending`** — re-revisão automática.

Tipos de documento: `identity` (RG ou CNH, foto ou PDF), `selfie` (só foto), `cnh` (só PDF da CNH Digital), `guardian_identity` (documento do responsável, só quando menor). Validação por assinatura real de bytes do arquivo, não pelo `Content-Type` declarado pelo cliente.

`reviewDocument` (`modules/admin/review-document.ts`) exige `reason` no corpo quando `status: 'rejected'` (400 sem isso), gravado em `documents.rejection_reason`. Como reenviar nunca atualiza a linha antiga (sempre insere uma nova, `upload-document.ts`), `get-worker-profile.ts` calcula `hasDocument`/`hasSelfie`/`hasCnhDocument`/`hasGuardianDocument` a partir do **documento mais recente de cada tipo** — um tipo cujo mais recente está `rejected` conta como "falta enviar" de novo (bug corrigido: antes bastava existir qualquer linha do tipo, aprovada ou não, pra achar que já tinha sido enviado, travando o reenvio pela tela de `/cadastro/documento`). O motivo do mais recente rejeitado vem em `documentRejectionReason`/`selfieRejectionReason`/`cnhRejectionReason`/`guardianDocumentRejectionReason`, mostrado acima do campo de upload correspondente. Enquanto `kycStatus !== 'approved'`, o app worker mostra um banner persistente no layout (`VerificationBanner`, visível em qualquer tela).

## Menor de idade

`MIN_WORKER_AGE_YEARS = 16` — abaixo disso, bloqueado sem exceção. `ADULT_AGE_YEARS = 18` — 16-17 exige dados do responsável + autorização explícita. `isMinor` é sempre calculado no servidor a partir de `birthDate`, nunca confia no valor enviado pelo cliente. Ver bug histórico corrigido em [`04-development/knowledge.md`](../../04-development/knowledge.md).

## Busca por raio (geolocalização ativa, diferente do check-in)

`update-worker-location.ts` grava `homeLat/Lng` + tenta geocodificação reversa pro rótulo de endereço (best-effort, nunca bloqueia salvar a localização se falhar). O rótulo é só exibição, nunca usado no cálculo de distância.

## Reputação — tudo calculado ao vivo

`totalShiftsCompleted`/`totalHoursWorked`: soma sobre turnos `completed`. `companiesServed`/`rehireRate`: agrupado por empresa, "recontratado" = 2+ turnos completos. `attendanceRate`: `(completed + checked_in) / (completed + checked_in + no_show)` — como `no_show` nunca é escrito, esse denominador nunca inclui falta real hoje (ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md)). `cancellations`: candidaturas retiradas pelo próprio trabalhador.

**As colunas de banco `totalShiftsCompleted`/`totalNoShows` são mortas** — tudo acima é recalculado, nunca lido dessas colunas.
