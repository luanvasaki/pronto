# Rotas do app admin — referência

> Site próprio, sem cadastro self-service — só quem já tem `isAdmin: true` no banco consegue passar do gate de `AdminLayout`.

| Rota | Função | Principais endpoints |
|---|---|---|
| `/` | Sempre redireciona pra `/entrar` | — |
| `/entrar` | Login (e-mail/senha ou Google), verifica `isAdmin` no front e desloga na hora se não for | `login`/`googleLogin`, `getCurrentUser` |
| `/esqueci-senha`, `/redefinir-senha` | Recuperação de senha | — |
| `/admin` | Visão geral: métricas, crescimento, pagamentos falhados, remover dados demo | `GET /admin/metrics`, `/admin/growth-metrics`, `/admin/failed-payments`, `DELETE /admin/demo-data` |
| `/admin/empresas` | Lista de empresas, busca, reset de senha | `GET /admin/companies` |
| `/admin/trabalhadores` | Lista de trabalhadores, busca, reset de senha | `GET /admin/workers` |
| `/admin/verificacoes` | Documentos de KYC, empresas pendentes, categorias pendentes — com preview de arquivo | `GET /admin/verifications`, `PATCH /admin/documents/:id`, `/admin/companies/:id/verification`, `/admin/skill-categories/:id` |

`AdminLayout` faz poll de `/admin/verifications` a cada 60s pro badge do sino da navegação lateral e do dropdown do Topbar (mesmo padrão de avatar/saudação/sino em dropdown do business e do worker — cada item do dropdown linka pra `/admin/verificacoes`, já que a tela ainda não tem âncora por item individual).

## Notas

- Todas as ações de aprovar/rejeitar exigem confirmação de duplo clique.
- Preview de documento (imagem/PDF) é buscado via fetch autenticado que vira blob URL — se o fetch falhar, os botões de aprovar/rejeitar continuam funcionando **sem preview visível**, sem aviso disso na tela (ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md)).
- Lista de "Pagamentos com falha" é só leitura — texto explícito na própria tela reconhecendo que não há retry automático.
