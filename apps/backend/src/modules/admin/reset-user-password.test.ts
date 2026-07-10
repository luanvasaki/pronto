import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { passwordResetTokens, users } from '../../db/schema';
import { EmailSender } from '../auth/email-sender';
import { HttpError } from '../../shared/errors/http-error';
import { resetUserPassword } from './reset-user-password';

const USER_PHONE = '+5511966661080';
const USER_EMAIL = 'reset-user-password@example.com';
const PHONE_ONLY_USER_PHONE = '+5511966661081';
const RESET_BASE_URL = 'https://empresas.pronto.example';

class CapturingEmailSender implements EmailSender {
  public lastEmail?: string;
  public lastResetUrl?: string;

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    this.lastEmail = email;
    this.lastResetUrl = resetUrl;
  }
}

describe('resetUserPassword', () => {
  afterEach(async () => {
    const user = await db.query.users.findFirst({ where: eq(users.phone, USER_PHONE) });
    if (user) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    }
    await db.delete(users).where(eq(users.phone, USER_PHONE));
    await db.delete(users).where(eq(users.phone, PHONE_ONLY_USER_PHONE));
  });

  it('gera um token, manda o e-mail e retorna o e-mail do usuário', async () => {
    const [user] = await db.insert(users).values({ phone: USER_PHONE, email: USER_EMAIL }).returning();
    const sender = new CapturingEmailSender();

    const result = await resetUserPassword(user.id, sender, RESET_BASE_URL);

    expect(result.email).toBe(USER_EMAIL);
    expect(sender.lastEmail).toBe(USER_EMAIL);
    expect(sender.lastResetUrl).toMatch(`${RESET_BASE_URL}/redefinir-senha?token=`);

    const tokens = await db.query.passwordResetTokens.findMany({ where: eq(passwordResetTokens.userId, user.id) });
    expect(tokens).toHaveLength(1);
  });

  it('recusa usuário sem e-mail cadastrado', async () => {
    const [user] = await db.insert(users).values({ phone: PHONE_ONLY_USER_PHONE }).returning();
    const sender = new CapturingEmailSender();

    await expect(resetUserPassword(user.id, sender, RESET_BASE_URL)).rejects.toThrow(HttpError);
    expect(sender.lastEmail).toBeUndefined();
  });

  it('recusa usuário inexistente', async () => {
    const sender = new CapturingEmailSender();

    await expect(
      resetUserPassword('00000000-0000-0000-0000-000000000000', sender, RESET_BASE_URL),
    ).rejects.toThrow(HttpError);
  });
});
