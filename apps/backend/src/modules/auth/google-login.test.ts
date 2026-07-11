import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
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
});
