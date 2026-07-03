import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { refreshTokens, users } from '../../db/schema';
import { issueTokens } from './issue-tokens';
import { logout } from './logout';
import { hashRefreshToken } from './refresh-token';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511944443001';

describe('logout', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('rejeita refresh token ausente', async () => {
    await expect(logout(undefined)).rejects.toThrow('obrigatório');
  });

  it('revoga o refresh token informado', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const tokens = await issueTokens(user.id);

    await logout(tokens.refreshToken);

    const row = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, hashRefreshToken(tokens.refreshToken)),
    });
    expect(row?.revokedAt).not.toBeNull();
  });

  it('não lança erro pra token desconhecido — idempotente', async () => {
    await expect(logout('token-que-nao-existe')).resolves.toBeUndefined();
  });

  it('não lança erro pra token já revogado — idempotente', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const tokens = await issueTokens(user.id);
    await logout(tokens.refreshToken);

    await expect(logout(tokens.refreshToken)).resolves.toBeUndefined();
  });
});
