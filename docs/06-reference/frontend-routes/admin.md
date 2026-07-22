# Rotas do app admin — referência

> Site próprio, sem cadastro self-service — só quem já tem `isAdmin: true` no banco consegue passar do gate de `AdminLayout`.

| Rota | Função | Principais endpoints |
|---|---|---|
| `/` | Sempre redireciona pra `/entrar` | — |
| `/entrar` | Login (e-mail/senha ou Google), verifica `isAdmin` no front e desloga na hora se não for | `login`/`googleLogin`, `getCurrentUser` |
| `/esqueci-senha`, `/redefinir-senha` | Recuperação de senha | — |
| `/admin` | Visão geral: métricas, crescimento, pagamentos falhados, remover dados demo | `GET /admin/metrics`, `/admin/growth-metrics`, `/admin/failed-payments`, `DELETE /admin/demo-data` |
| `/admin/empresas` | Lista de empresas, busca, reset de senha, histórico de aceite de termos (colapsado) | `GET /admin/companies` |
| `/admin/trabalhadores` | Lista de trabalhadores, busca, reset de senha, histórico de aceite de termos (colapsado) | `GET /admin/workers` |
| `/admin/verificacoes` | Documentos de KYC, empresas pendentes, categorias pendentes — com preview de arquivo | `GET /admin/verifications`, `PATCH /admin/documents/:id`, `/admin/companies/:id/verification`, `/admin/skill-categories/:id` |

`AdminLayout` faz poll de `/admin/verifications` a cada 60s pro badge do sino da navegação lateral e do dropdown do Topbar (mesmo padrão de avatar/saudação/sino em dropdown do business e do worker — cada item do dropdown linka pra `/admin/verificacoes`, já que a tela ainda não tem âncora por item individual).

## Notas

- Todas as ações de aprovar/rejeitar exigem confirmação de duplo clique.
- Rejeitar (documento de trabalhador ou empresa) exige preencher um motivo antes de armar a confirmação — clique ou atalho de teclado `r` sem texto só focam o campo, sem chamar a API. O motivo persiste (`rejection_reason`) e aparece pro trabalhador/empresa saber o que corrigir antes de reenviar.
- Preview de documento (imagem/PDF) é buscado via fetch autenticado que vira blob URL — se o fetch falhar, os botões de aprovar/rejeitar continuam funcionando **sem preview visível**, sem aviso disso na tela (ver [`05-operations/known-issues.md`](../../05-operations/known-issues.md)).
- Lista de "Pagamentos com falha" é só leitura — texto explícito na própria tela reconhecendo que não há retry automático.
- **Histórico de aceite de termos** (`ConsentHistory`, `/admin/empresas` e `/admin/trabalhadores`): colapsado por padrão (raramente consultado, é prova pra disputa jurídica, não info do dia a dia). Mostra versão/data/IP do `platform_terms`, do `login_summary` mais recente, e (só empresas) de cada vaga com o termo `minors_opportunity` aceito. Só leitura, dado já vem no `GET /admin/companies`/`workers`, sem fetch extra por item.
