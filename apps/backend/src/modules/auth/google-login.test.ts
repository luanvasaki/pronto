import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { CURRENT_TERMS_VERSION } from '../../shared/terms-version';
import { googleLogin } from './google-login';
import { GoogleTokenVerifier, GoogleUserInfo } from './google-token-verifier';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_EMAIL = 'google-login-race-test@example.com';
const TEST_GOOGLE_ID = 'google-race-test-id-1';

function fakeVerifier(userInfo: GoogleUserInfo): GoogleTokenVerifier {
  return { verify: async () => userInfo };
}

describe('googleLogin', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
  });

  it('mesmo em corrida (duas chamadas simultâneas com o mesmo Google ID), as duas logam na mesma conta em vez de uma falhar', async () => {
    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });

    const results = await Promise.all([
      googleLogin('fake-token', true, verifier),
      googleLogin('fake-token', true, verifier),
    ]);

    expect(results[0].user.id).toBe(results[1].user.id);

    const rows = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(rows).toHaveLength(1);
  });

  it('loga na conta já criada por uma corrida, em vez de recusar como se fosse conta de senha', async () => {
    // Simula deterministicamente o que a corrida acima só produz por
    // timing: a conta Google já existe (outra chamada "venceu") no
    // instante em que o byEmail desta chamada roda.
    const [existing] = await db
      .insert(users)
      .values({ email: TEST_EMAIL, googleId: TEST_GOOGLE_ID, termsAcceptedAt: new Date() })
      .returning();

    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });

    const result = await googleLogin('fake-token', true, verifier);

    expect(result.user.id).toBe(existing.id);
  });

  it('grava o momento e a versão do aceite dos termos ao criar a conta', async () => {
    const before = new Date();
    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });

    await googleLogin('fake-token', true, verifier);

    const [row] = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(row.termsAcceptedAt).not.toBeNull();
    expect(row.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(row.termsVersion).toBe(CURRENT_TERMS_VERSION);
  });

  it('continua recusando quando o e-mail já é de uma conta de senha de verdade (sem googleId)', async () => {
    await db.insert(users).values({ email: TEST_EMAIL, passwordHash: 'hash-qualquer' });

    const verifier = fakeVerifier({
      email: TEST_EMAIL,
      googleId: TEST_GOOGLE_ID,
      emailVerified: true,
      picture: 'https://example.com/photo.jpg',
    });

    await expect(googleLogin('fake-token', true, verifier)).rejects.toThrow('Já existe uma conta com senha');
  });
});
