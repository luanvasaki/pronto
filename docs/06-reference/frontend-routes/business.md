# Rotas do app business — referência

> Jornada completa em [`02-product/user-journey.md`](../../02-product/user-journey.md).

| Rota | Função | Principais dados/endpoints |
|---|---|---|
| `/` | Landing | — |
| `/entrar` | Login | `login`, `googleLogin` |
| `/cadastro/conta` | Criar conta | `register` |
| `/cadastro` | Perfil da empresa (CNPJ/CPF + documento de verificação, sempre) | `upsertCompanyProfile`, `uploadCompanyDocument` |
| `(app)/painel` | Dashboard: cobertura 48h, central de ações | `getCompanyDashboard`, `listMyJobs` |
| `(app)/escala` | Calendário (mês/semana/Ao vivo), duplicar semana | `listMyJobs`, `duplicateWeek`, `getLiveEventStatus` |
| `(app)/escalas` | Lista de vagas abertas, cancelar | `listMyJobs`, `cancelJob` |
| `(app)/vagas/nova` | Publicar vaga (com template) | `createJob`, `createSkillCategory` |
| `(app)/vagas/[id]/editar` | Editar vaga (só se `open`) | `updateJob` |
| `(app)/vagas/[id]` | Candidatos: aprovar/rejeitar/remover, check-in/out, pagamento, avaliação | `listJobApplications`, `updateApplicationStatus`, `confirmCheckIn`/`confirmCheckOut`, `releasePayment`, `rateShift`, `skipRating` |
| `(app)/trabalhadores` | Histórico de todo trabalhador já contratado | `getCompanyWorkerHistory` |
| `(app)/perfil` | Dados da empresa, logo, senha, avaliações recebidas, reenvio de documento se verificação recusada | `getCompanyProfile`, `listCompanyRatings`, `uploadCompanyDocument` |

`(app)/layout.tsx` centraliza auth-gate, `CompanyProfileProvider`, e polling de notificações (60s). O sino (`topbar.tsx`) **não confirma nada sozinho** ao abrir — a confirmação de check-in/out é ação explícita nos botões da tela da vaga.

`/vagas/nova` bloqueia o botão de publicar (não só avisa) enquanto a empresa não está `approved` — o backend (`create-job.ts`) também recusa por segurança, mas a UI já impede antes de preencher o formulário inteiro pra descobrir isso só no submit.
