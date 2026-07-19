# Módulo `push` — referência

> Implementação real (VAPID / `web-push`), não mock — ver [`03-architecture/integrations.md`](../../03-architecture/integrations.md).

## Rotas

| Rota | Função |
|---|---|
| `GET /push/vapid-public-key` | Público de propósito (chave pública não é segredo) |
| `POST /push/subscribe` | Registra/atualiza a inscrição de um dispositivo |

## Comportamento

`sendPushToUser()` nunca lança — notificação é complemento, não caminho crítico. Sem `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` configuradas, vira no-op silencioso. Inscrições que o navegador já revogou (resposta 404/410 do endpoint de push) são limpas automaticamente do banco. Upsert natural por `endpoint` único — rotação de inscrição pelo navegador não duplica linha.

Disparado hoje por: check-in e check-out de turno (módulo `shifts`, notificando a empresa).
