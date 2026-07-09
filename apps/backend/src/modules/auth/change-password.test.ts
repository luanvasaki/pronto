import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { refreshTokens, users } from '../../db/schema';
import { changePassword } from './change-password';
import { hashPassword } from './password';

// Fixture única entre arquivos de teste (ver README).
const TEST_EMAIL = 'change-password-test@example.com';
const GOOGLE_ONLY_EMAIL = 'change-password-google@example.com';
const CURRENT_PASSWORD = 'senha-atual-123';

async function createTestUser(email: string, passwordHash: string | null) {
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();
  return user;
}

describe('changePassword', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(users).where(eq(users.email, GOOGLE_ONLY_EMAIL));
  });

  it('rejeita nova senha inválida', async () => {
    const user = await createTestUser(TEST_EMAIL, await hashPassword(CURRENT_PASSWORD));

    await expect(changePassword(user.id, CURRENT_PASSWORD, '123')).rejects.toThrow(
      'Nova senha deve ter entre 8 e 72 caracteres',
    );
  });

  it('rejeita conta sem senha (só Google)', async () => {
    const user = await createTestUser(GOOGLE_ONLY_EMAIL, null);

    await expect(changePassword(user.id, 'qualquer-coisa', 'nova-senha-123')).rejects.toThrow(
      'não existe senha pra trocar',
    );
  });

  it('rejeita senha atual incorreta', async () => {
    const user = await createTestUser(TEST_EMAIL, await hashPassword(CURRENT_PASSWORD));

    await expect(changePassword(user.id, 'senha-errada', 'nova-senha-123')).rejects.toThrow(
      'Senha atual incorreta',
    );
  });

  it('troca a senha e emite tokens novos', async () => {
    const user = await createTestUser(TEST_EMAIL, await hashPassword(CURRENT_PASSWORD));

    const tokens = await changePassword(user.id, CURRENT_PASSWORD, 'nova-senha-456');

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const updated = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    expect(updated?.passwordHash).not.toBe(user.passwordHash);
  });

  it('revoga sessões antigas ao trocar a senha', async () => {
    const user = await createTestUser(TEST_EMAIL, await hashPassword(CURRENT_PASSWORD));
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: 'hash-de-sessao-antiga',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await changePassword(user.id, CURRENT_PASSWORD, 'nova-senha-456');

    const oldSession = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, 'hash-de-sessao-antiga'),
    });
    expect(oldSession?.revokedAt).not.toBeNull();
  });
});
