import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { passwordResetTokens, refreshTokens, users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { hashPasswordResetToken } from './password-reset-token';
import { hashPassword, isValidPassword } from './password';

const INVALID_TOKEN_MESSAGE = 'Link de redefinição inválido ou expirado.';

export async function resetPassword(
  token: string | undefined,
  newPassword: string | undefined,
): Promise<void> {
  if (!token || !newPassword || !isValidPassword(newPassword)) {
    throw new HttpError(400, INVALID_TOKEN_MESSAGE);
  }

  const tokenHash = hashPasswordResetToken(token);
  const stored = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, INVALID_TOKEN_MESSAGE);
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, stored.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, stored.id));
    // Troca de senha por reset derruba qualquer sessão que possa ter
    // sido comprometida — mesma ideia da detecção de reuso do refresh token.
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
  });
}
