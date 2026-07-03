import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { refreshTokens } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { hashRefreshToken } from './refresh-token';

/**
 * Idempotente de propósito: revoga se existir e ainda estiver ativo,
 * não faz nada caso contrário — sem diferenciar o resultado pro
 * cliente, o objetivo final ("essa sessão não está mais ativa") é o
 * mesmo dos dois jeitos.
 */
export async function logout(providedToken: string | undefined): Promise<void> {
  if (!providedToken) {
    throw new HttpError(400, 'Refresh token é obrigatório.');
  }

  const tokenHash = hashRefreshToken(providedToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}
