# Rotas do app business — referência

> Jornada completa em [`02-product/user-journey.md`](../../02-product/user-journey.md).

| Rota | Função | Principais dados/endpoints |
|---|---|---|
| `/` | Landing | — |
| `/entrar` | Login | `login`, `googleLogin` |
| `/cadastro/conta` | Criar conta | `register` |
| `/cadastro` | Perfil da empresa (CNPJ/CPF, documento se PF) | `upsertCompanyProfile`, `uploadCompanyDocument` |
| `(app)/painel` | Dashboard: cobertura 48h, central de ações | `getCompanyDashboard`, `listMyJobs` |
| `(app)/escala` | Calendário (mês/semana/Ao vivo), duplicar semana | `listMyJobs`, `duplicateWeek`, `getLiveEventStatus` |
| `(app)/escalas` | Lista de vagas abertas, cancelar | `listMyJobs`, `cancelJob` |
| `(app)/vagas/nova` | Publicar vaga (com template) | `createJob`, `createSkillCategory` |
| `(app)/vagas/[id]/editar` | Editar vaga (só se `open`) | `updateJob` |
| `(app)/vagas/[id]` | Candidatos: aprovar/rejeitar/remover, check-in/out, pagamento, avaliação | `listJobApplications`, `updateApplicationStatus`, `confirmCheckIn`/`confirmCheckOut`, `releasePayment`, `rateShift`, `skipRating` |
| `(app)/trabalhadores` | Histórico de todo trabalhador já contratado | `getCompanyWorkerHistory` |
| `(app)/perfil` | Dados da empresa, logo, senha, avaliações recebidas | `getCompanyProfile`, `listCompanyRatings` |

`(app)/layout.tsx` centraliza auth-gate, `CompanyProfileProvider`, e polling de notificações (60s). O sino (`topbar.tsx`) **não confirma nada sozinho** ao abrir — a confirmação de check-in/out é ação explícita nos botões da tela da vaga.

## Sobre `/cadastro` — pessoa jurídica sem upload de documento

O upload de documento (`uploadCompanyDocument`) só é chamado no ramo de pessoa física (CPF). Não há fluxo de verificação por documento pra CNPJ nesse app — ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md).

## Código morto conhecido nesta pasta

`src/components/ui/growth-chart.tsx` (+ teste) — sem consumidor, sobrou da época em que o painel admin vivia dentro deste app. Ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md).
