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

  // Condicional em isNull(revokedAt) fecha a corrida entre duas chamadas
  // simultâneas com o mesmo token: só uma UPDATE afeta linha (a outra
  // vê 0 linhas e cai no "sessão inválida" em vez de também emitir
  // tokens novos — sem isso um único refresh token vira duas sessões.
  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });

  if (revoked.length === 0) {
    throw new HttpError(401, INVALID_SESSION_MESSAGE);
  }

  return issueTokens(stored.userId);
}
