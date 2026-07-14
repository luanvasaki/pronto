import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { pushSubscriptions } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

/** Silenciosamente não faz nada se o endpoint já não existir — sair de um dispositivo que já saiu não é erro. */
export async function unsubscribeFromPush(userId: string, endpoint: string | undefined): Promise<void> {
  const trimmed = endpoint?.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Endpoint é obrigatório.');
  }

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, trimmed)));
}
