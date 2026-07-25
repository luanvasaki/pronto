import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { EmailSender } from './email-sender';
import { googleLogin } from './google-login';
import { GoogleTokenVerifier, GoogleUserInfo } from './google-token-verifier';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_EMAIL = 'google-login-race-test@example.com';
const TEST_GOOGLE_ID = 'google-race-test-id-1';

function fakeVerifier(userInfo: GoogleUserInfo): GoogleTokenVerifier {
  return { verify: async () => userInfo };
}

class FakeEmailSender implements EmailSender {
  public welcomeEmails: string[] = [];

  async sendPasswordResetEmail(): Promise<void> {}
  async sendKycApprovedEmail(): Promise<void> {}
  async sendKycRejectedEmail(): Promise<void> {}

  async sendWelcomeEmail(email: string): Promise<void> {
    this.welcomeEmails.push(email);
  }
}

describe('googleLogin', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
  });

  it('rejeita e-mail do Google não verificado, sem criar conta', async () => {
    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: false,
      picture: 'https://example.com/photo.jpg',
    });

    await expect(googleLogin('fake-token', verifier, new FakeEmailSender())).rejects.toThrow(
      'E-mail do Google não verificado',
    );

    const rows = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(rows).toHaveLength(0);
  });

  it('mesmo em corrida (duas chamadas simultâneas com o mesmo Google ID), as duas logam na mesma conta em vez de uma falhar', async () => {
    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });
    const sender = new FakeEmailSender();

    const results = await Promise.all([
      googleLogin('fake-token', verifier, sender),
      googleLogin('fake-token', verifier, sender),
    ]);

    expect(results[0].user.id).toBe(results[1].user.id);

    const rows = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(rows).toHaveLength(1);
    // Só quem realmente criou a conta manda o e-mail — a outra chamada da
    // corrida caiu no branch de "raceWinner" (login na conta já criada).
    expect(sender.welcomeEmails).toEqual([TEST_EMAIL]);
  });

  it('loga na conta já criada por uma corrida, em vez de recusar como se fosse conta de senha', async () => {
    // Simula deterministicamente o que a corrida acima só produz por
    // timing: a conta Google já existe (outra chamada "venceu") no
    // instante em que o byEmail desta chamada roda.
    const [existing] = await db.insert(users).values({ email: TEST_EMAIL, googleId: TEST_GOOGLE_ID }).returning();

    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });
    const sender = new FakeEmailSender();

    const result = await googleLogin('fake-token', verifier, sender);

    expect(result.user.id).toBe(existing.id);
    // Conta já existia antes dessa chamada — não é uma criação nova, não
    // manda boas-vindas de novo.
    expect(sender.welcomeEmails).toEqual([]);
  });

  it('cria a conta sem nenhum aceite de termos ainda — isso agora é uma etapa separada (ver accept-terms.ts)', async () => {
    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });

    await googleLogin('fake-token', verifier, new FakeEmailSender());

    const [row] = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(row.termsAcceptedAt).toBeNull();
    expect(row.termsVersion).toBeNull();
  });

  it('manda e-mail de boas-vindas ao criar conta nova pela primeira vez', async () => {
    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });
    const sender = new FakeEmailSender();

    await googleLogin('fake-token', verifier, sender);

    expect(sender.welcomeEmails).toEqual([TEST_EMAIL]);
  });

  it('continua recusando quando o e-mail já é de uma conta de senha de verdade (sem googleId)', async () => {
    await db.insert(users).values({ email: TEST_EMAIL, passwordHash: 'hash-qualquer' });

    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });

    await expect(googleLogin('fake-token', verifier, new FakeEmailSender())).rejects.toThrow(
      'Já existe uma conta com senha',
    );
  });
});
