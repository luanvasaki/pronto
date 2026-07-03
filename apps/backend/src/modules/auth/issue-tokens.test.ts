import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { refreshTokens, users } from '../../db/schema';
import { issueTokens } from './issue-tokens';
import { verifyAccessToken } from './jwt';
import { hashRefreshToken } from './refresh-token';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511888880000';

describe('issueTokens', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('emite um access token válido pro usuário e um refresh token persistido com hash', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();

    const tokens = await issueTokens(user.id);

    expect(verifyAccessToken(tokens.accessToken).sub).toBe(user.id);

    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.userId, user.id),
    });
    expect(stored?.tokenHash).toBe(hashRefreshToken(tokens.refreshToken));
    expect(stored?.revokedAt).toBeNull();
  });

  it('remove os refresh tokens junto quando o usuário é removido (cascade)', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    await issueTokens(user.id);

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db.query.refreshTokens.findMany({
      where: eq(refreshTokens.userId, user.id),
    });
    expect(remaining).toHaveLength(0);
  });
});
