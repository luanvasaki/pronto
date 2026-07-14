import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { CURRENT_TERMS_VERSION } from '../../shared/terms-version';
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

  it('grava o momento e a versão do aceite dos termos ao criar a conta', async () => {
    const before = new Date();
    await register(TEST_EMAIL, TEST_PASSWORD, true);

    const [row] = await db.query.users.findMany({ where: eq(users.email, TEST_EMAIL) });
    expect(row.termsAcceptedAt).not.toBeNull();
    expect(row.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(row.termsVersion).toBe(CURRENT_TERMS_VERSION);
  });

  it('rejeita quando os termos não são aceitos', async () => {
    await expect(register(TEST_EMAIL, TEST_PASSWORD, false)).rejects.toThrow('aceitar os Termos de Uso');
    await expect(register(TEST_EMAIL, TEST_PASSWORD, undefined)).rejects.toThrow('aceitar os Termos de Uso');
  });
});
