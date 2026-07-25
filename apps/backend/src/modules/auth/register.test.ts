import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { EmailSender } from './email-sender';
import { register } from './register';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_EMAIL = 'register-race-test@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';

class FakeEmailSender implements EmailSender {
  public welcomeEmails: string[] = [];

  async sendPasswordResetEmail(): Promise<void> {}
  async sendKycApprovedEmail(): Promise<void> {}
  async sendKycRejectedEmail(): Promise<void> {}

  async sendWelcomeEmail(email: string): Promise<void> {
    this.welcomeEmails.push(email);
  }
}

class ThrowingEmailSender implements EmailSender {
  async sendPasswordResetEmail(): Promise<void> {}
  async sendKycApprovedEmail(): Promise<void> {}
  async sendKycRejectedEmail(): Promise<void> {}

  async sendWelcomeEmail(): Promise<void> {
    throw new Error('Falha simulada no provedor de e-mail.');
  }
}

describe('register', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
  });

  it('mesmo em corrida (duas chamadas simultâneas com o mesmo e-mail), só uma cria conta e a outra recebe 409 amigável', async () => {
    const sender = new FakeEmailSender();
    const results = await Promise.allSettled([
      register(TEST_EMAIL, TEST_PASSWORD, sender),
      register(TEST_EMAIL, TEST_PASSWORD, sender),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejection = rejected[0] as PromiseRejectedResult;
    expect(rejection.reason).toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Já existe uma conta'),
    });

    const rows = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(rows).toHaveLength(1);
  });

  it('cria a conta sem nenhum aceite de termos ainda — isso agora é uma etapa separada (ver accept-terms.ts)', async () => {
    await register(TEST_EMAIL, TEST_PASSWORD, new FakeEmailSender());

    const [row] = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(row.termsAcceptedAt).toBeNull();
    expect(row.termsVersion).toBeNull();
  });

  it('manda e-mail de boas-vindas pro e-mail cadastrado', async () => {
    const sender = new FakeEmailSender();

    await register(TEST_EMAIL, TEST_PASSWORD, sender);

    expect(sender.welcomeEmails).toEqual([TEST_EMAIL]);
  });

  it('cria a conta normalmente mesmo se o envio do e-mail de boas-vindas falhar', async () => {
    const result = await register(TEST_EMAIL, TEST_PASSWORD, new ThrowingEmailSender());

    expect(result.user.email).toBe(TEST_EMAIL);
    const rows = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(rows).toHaveLength(1);
  });
});
