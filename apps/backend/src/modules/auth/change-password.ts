import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { refreshTokens, users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { IssuedTokens, issueTokens } from './issue-tokens';
import { hashPassword, isValidPassword, verifyPassword } from './password';

/**
 * Troca de senha por quem já está logado (diferente de reset-password,
 * que é pra quem esqueceu e não tem sessão). Exige a senha atual —
 * conta só-Google não tem `passwordHash`, não tem senha pra trocar.
 * Derruba qualquer outra sessão ativa (mesma ideia do reset via
 * e-mail), mas emite um par de tokens novo pra sessão atual continuar
 * logada, já que ela acabou de provar que sabe a senha atual.
 */
export async function changePassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string | undefined,
): Promise<IssuedTokens> {
  if (!newPassword || !isValidPassword(newPassword)) {
    throw new HttpError(400, 'Nova senha deve ter entre 8 e 72 caracteres.');
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new HttpError(401, 'Sessão inválida ou expirada.');
  }

  if (!user.passwordHash) {
    throw new HttpError(400, 'Essa conta usa login com Google — não existe senha pra trocar.');
  }

  if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(401, 'Senha atual incorreta.');
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  });

  return issueTokens(userId);
}
