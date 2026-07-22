# Rotas do app worker — referência

> Jornada completa em [`02-product/user-journey.md`](../../02-product/user-journey.md). Padrões de arquitetura em [`03-architecture/frontend-architecture.md`](../../03-architecture/frontend-architecture.md).

| Rota | Função | Principais dados/endpoints |
|---|---|---|
| `/` | Landing, marketing + FAQ | — |
| `/entrar` | Login (e-mail/senha ou Google) | `login`, `googleLogin` |
| `/cadastro/conta` | Criar conta | `register` |
| `/cadastro/termos` | Leitura em tela cheia do documento completo (12 capítulos) + aceite, antes do perfil | `getConsentDocument('platform_terms')`, `acceptTerms` |
| `/cadastro` | Perfil (dados pessoais, endereço via CEP, categorias, menor de idade) | `upsertWorkerProfile`, `uploadWorkerPhoto` |
| `/cadastro/documento` | KYC (documento, selfie, CNH, responsável) — mostra o motivo de cada tipo reprovado acima do campo de upload correspondente | `uploadWorkerDocument`/`Selfie`/`CnhDocument`/`GuardianDocument` |
| `/esqueci-senha`, `/redefinir-senha` | Recuperação de senha | `forgotPassword`, `resetPassword` |
| `(app)/inicio` | Busca de vagas por proximidade, candidatura | `listNearbyJobs`, `applyToJob`, `updateWorkerLocation`, `updateSearchRadius` |
| `(app)/vaga/[id]` | Detalhe da vaga, perguntas, avisos — candidatura exige abrir e aceitar o modal do termo (recorte dos capítulos 3 e 6) antes de habilitar "Aceitar escala" | `getJobDetail`, `listJobQuestions`/`askQuestion`, `listJobAnnouncements` |
| `(app)/candidaturas` | Minhas candidaturas | `listMyApplications`, `withdrawApplication` |
| `(app)/agenda` | Calendário de turnos, check-in/out, pagamento, avaliação | `listMyShifts`, `checkIn`, `checkOut`, `confirmPayment`, `rateShift` |
| `(app)/ganhos` | Resumo financeiro (agregado local) | `listMyShifts` |
| `(app)/perfil` | Editar perfil, avaliações recebidas, aviso + link pra reenviar quando `kycStatus === 'rejected'` | `listWorkerRatings`, `upsertWorkerProfile` |

`(app)/layout.tsx` centraliza: gate de sessão (`useRequireAuth`), busca do perfil uma vez (`WorkerProfileProvider`), redirecionamento pra completar KYC se faltar documento/selfie/documento de responsável (cobre login por e-mail e por Google), redirecionamento pra `/cadastro/termos` se `needsTermsAcceptance` (cobre também contas antigas, criadas antes desse sistema existir), modal bloqueante do "Termo Resumido de Ciência" (`LoginTermsModal`) se `!hasAcceptedLoginTerms` (independente do redirecionamento acima), banner persistente (`VerificationBanner`, logo abaixo do Topbar, em qualquer tela) enquanto `kycStatus !== 'approved'`, e polling de notificações (candidaturas + turnos) a cada 60s.

Funil de cadastro é `conta` (1) → `termos` (2, novo) → `cadastro`/perfil (3) → `documento` (4) — `SignupProgress` com `totalSteps={4}`.

`/cadastro` pede o endereço via CEP (`AddressFields` + `lookupCep`/ViaCEP, mesmo componente do endereço de vaga da empresa) — rua/bairro/cidade/UF preenchidos automaticamente, número/complemento manuais. Sem geocodificação aqui: vira só a string `homeAddressFull` (protegida, nunca exposta pra empresa); a localização usada pra "vagas perto de mim" (`homeLat/Lng`) continua vindo só do GPS em `/inicio`, fluxo separado.

## PWA

`manifest.ts` (start_url `/entrar`, display standalone), service worker registrado mas **sem estratégia de cache** (só existe pra passar no critério de instalabilidade). Banner de instalação nativo no Android/Chrome, passo a passo manual no iOS.
