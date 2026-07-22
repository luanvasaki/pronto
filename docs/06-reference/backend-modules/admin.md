# Módulo `admin` — referência

> Autorização: middleware `requireAdmin` roda depois de `requireAuth`, consulta `users.isAdmin` no banco a cada request (sem cache — poucas chamadas admin, custo de servir permissão desatualizada é maior que uma query extra). `isAdmin` só é setado por update direto no banco.

## Rotas (todas atrás de `requireAuth` + `requireAdmin`)

| Rota | Função |
|---|---|
| `GET /admin/metrics` | Totais agregados: pagamentos por status, workers, empresas, turnos |
| `GET /admin/growth-metrics` | Séries de 8 semanas: empresas/workers criados, turnos concluídos |
| `GET /admin/verifications` | Lista unificada: documentos pendentes, empresas pendentes, categorias pendentes |
| `GET /admin/documents/:id/file`, `/admin/company-documents/:id/file` | Proxy autenticado do arquivo (nunca expõe URL do storage direto) |
| `PATCH /admin/documents/:id` | Aprova/rejeita documento de KYC — recalcula `kycStatus` numa transação |
| `PATCH /admin/companies/:id/verification` | Aprova/rejeita empresa |
| `PATCH /admin/skill-categories/:id` | Aprova (com correção de nome opcional) / rejeita categoria |
| `DELETE /admin/demo-data` | Remove em cascata manual tudo marcado `isDemo: true` |
| `GET /admin/companies`, `/admin/workers` | Listas com métricas agregadas, ordenadas por volume — inclui histórico de aceite de termos (versão/data/IP do `platform_terms`, do `login_consents` mais recente, e pra empresa, cada vaga com `minorsTermsAcceptedAt`), pra prova em disputa jurídica |
| `GET /admin/failed-payments` | Pagamentos `failed`, pra ação manual (sem retry automático) |
| `POST /admin/users/:id/reset-password` | Dispara o fluxo de "esqueci senha" em nome do admin |

## Notas específicas

- **`PATCH /admin/documents/:id`**: considera só o documento **mais recente de cada tipo** por trabalhador (reenviar depois de rejeitado não bloqueia aprovação futura), e valida de verdade os dados de responsável pra menores, não só o tipo de arquivo enviado.
- **Aprovação de empresa/categoria**: UPDATE condicional (`WHERE status = 'pending'`) fecha a corrida de revisão dupla, mesmo padrão do resto do sistema.
- **`DELETE /admin/demo-data`**: apaga na ordem certa (ratings→payments→shifts→applications→jobs→users donos) porque as FKs de negócio não têm `onDelete: cascade`.
- **`totalJobsPosted`/`totalShiftsCompleted` são colunas mortas** — as listagens de empresas/workers aqui contam tudo ao vivo via `count(*) filter`, não confiam nessas colunas.
- **Histórico de aceite de termos** (`list-companies.ts`/`list-workers.ts`): só leitura, sem endpoint próprio. `login_consents` pode ter várias linhas por usuário (uma por versão já aceita) — a listagem pega sempre a mais recente por `acceptedAt`. Renderizado colapsado (componente `ConsentHistory`, apps/admin) nas páginas `/admin/empresas`/`/admin/trabalhadores`.
