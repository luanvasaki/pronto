# Módulos `skill-categories`, `questions`, `announcements` — referência

> Três módulos pequenos, todos ligados ao engajamento em torno de uma vaga publicada. Agrupados aqui por tamanho, não porque compartilham código.

## `skill-categories`

| Rota | Função |
|---|---|
| `GET /skill-categories` | Público, sem auth — só retorna `status = 'approved'` |
| `POST /skill-categories` | Autenticado — cria categoria sob demanda |

Qualquer usuário (empresa ou trabalhador) pode criar uma categoria nova durante o próprio cadastro ou publicação de vaga, **antes mesmo de ter um perfil formal criado**. Nasce `status: 'pending'`, mas já é usável imediatamente (não bloqueia nada) — só entra na fila de revisão do admin. Nome duplicado (case/acento-insensível) retorna a categoria existente em vez de duplicar; corrida de criação simultânea tratada.

## `questions`

| Rota | Função |
|---|---|
| `POST/GET /jobs/:jobId/questions` | Perguntar / listar |
| `PATCH /questions/:id/answer` | Responder (só o dono da empresa) |

Só quem tem candidatura na vaga (qualquer status) pode perguntar. Perguntas são **públicas entre todos os inscritos**, não só de quem perguntou. Bloqueio heurístico de número de telefone no texto (regex de 9-13 dígitos, com viés pra bloquear demais em vez de deixar passar).

## `announcements`

| Rota | Função |
|---|---|
| `POST/GET /jobs/:jobId/announcements` | Publicar aviso / listar |

Diferente de editar a vaga, **não checa o status dela** — aviso vale mesmo com vaga preenchida ou cancelada ("é assim que a empresa avisa os inscritos de mudança de última hora"). Mesmo bloqueio de telefone que `questions`. Mesma regra de acesso pra visualizar (dono ou qualquer candidato, independente do status da vaga).
