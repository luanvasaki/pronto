import { db } from '../../db/client';
import { pushSubscriptions } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface PushSubscriptionInput {
  endpoint: string | undefined;
  keys: { p256dh?: string; auth?: string } | undefined;
}

/**
 * Upsert por endpoint — o navegador pode gerar um endpoint novo pra uma
 * inscrição que já existia (rotação natural do PushManager); reenviar
 * com o mesmo endpoint só atualiza as chaves e o dono, em vez de
 * duplicar linha.
 */
export async function subscribeToPush(userId: string, input: PushSubscriptionInput): Promise<{ id: string }> {
  const endpoint = input.endpoint?.trim();
  const p256dh = input.keys?.p256dh;
  const auth = input.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new HttpError(400, 'Inscrição de notificação inválida.');
  }

  const [subscription] = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh, auth },
    })
    .returning();

  if (!subscription) {
    throw new HttpError(500, 'Não foi possível salvar a inscrição de notificação.');
  }

  return { id: subscription.id };
}
