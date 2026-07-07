import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { passwordResetTokens, users } from '../../db/schema';
import { isValidEmail } from './email';
import { EmailSender } from './email-sender';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from './password-reset-token';

/**
 * Sempre retorna sem erro, exista ou não o e-mail — quem decide a
 * resposta HTTP (sempre a mesma) é o controller; aqui só evitamos
 * mandar e-mail quando não há o que mandar.
 */
export async function forgotPassword(
  email: string | undefined,
  sender: EmailSender,
  resetBaseUrl: string,
): Promise<void> {
  if (!email || !isValidEmail(email)) {
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    return;
  }

  const token = generatePasswordResetToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${resetBaseUrl}/redefinir-senha?token=${token}`;
  await sender.sendPasswordResetEmail(email, resetUrl);
}
