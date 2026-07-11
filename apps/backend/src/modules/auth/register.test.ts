import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { register } from './register';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_EMAIL = 'register-race-test@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';

describe('register', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
  });

  it('mesmo em corrida (duas chamadas simultâneas com o mesmo e-mail), só uma cria conta e a outra recebe 409 amigável', async () => {
    const results = await Promise.allSettled([
      register(TEST_EMAIL, TEST_PASSWORD, true),
      register(TEST_EMAIL, TEST_PASSWORD, true),
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
});
