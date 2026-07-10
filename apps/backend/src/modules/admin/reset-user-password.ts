import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { passwordResetTokens, users } from '../../db/schema';
import { EmailSender } from '../auth/email-sender';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '../auth/password-reset-token';
import { HttpError } from '../../shared/errors/http-error';

export interface ResetUserPasswordResult {
  email: string;
}

/**
 * Mesmo mecanismo de forgotPassword (token de uso único por e-mail) — o
 * admin nunca vê nem define a senha de outra conta, só dispara o mesmo
 * fluxo seguro que "Esqueci minha senha" já usa. Diferente do endpoint
 * público, aqui quem pergunta já está autenticado como admin, então o
 * erro é explícito em vez de sempre "sucesso" (não há enumeration a
 * proteger de alguém que já tem acesso à lista de usuários).
 */
export async function resetUserPassword(
  userId: string,
  sender: EmailSender,
  resetBaseUrl: string,
): Promise<ResetUserPasswordResult> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }
  if (!user.email) {
    throw new HttpError(400, 'Esse usuário não tem e-mail cadastrado — não é possível enviar o link.');
  }

  const token = generatePasswordResetToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${resetBaseUrl}/redefinir-senha?token=${token}`;
  await sender.sendPasswordResetEmail(user.email, resetUrl);

  return { email: user.email };
}
