import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { refreshTokens } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { issueTokens, IssuedTokens } from './issue-tokens';
import { hashRefreshToken } from './refresh-token';

const INVALID_SESSION_MESSAGE = 'Sessão inválida.';

/**
 * Rotação com detecção de reuso: um refresh token só serve uma vez.
 * Se o token apresentado já estiver revogado, isso é sinal de token
 * roubado (alguém tem uma cópia antiga) — revoga TODAS as sessões
 * daquele usuário, não só nega esta tentativa.
 */
export async function refreshSession(providedToken: string | undefined): Promise<IssuedTokens> {
  if (!providedToken) {
    throw new HttpError(400, 'Refresh token é obrigatório.');
  }

  const tokenHash = hashRefreshToken(providedToken);
  const stored = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });

  if (!stored) {
    throw new HttpError(401, INVALID_SESSION_MESSAGE);
  }

  if (stored.revokedAt) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
    throw new HttpError(401, INVALID_SESSION_MESSAGE);
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, INVALID_SESSION_MESSAGE);
  }

  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, stored.id));

  return issueTokens(stored.userId);
}
