import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { refreshTokens, users } from '../../db/schema';
import { issueTokens } from './issue-tokens';
import { verifyAccessToken } from './jwt';
import { hashRefreshToken } from './refresh-token';
import { refreshSession } from './refresh-session';

// Fixture única entre arquivos de teste (ver README).
const TEST_PHONE = '+5511944443000';

describe('refreshSession', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('rejeita refresh token ausente', async () => {
    await expect(refreshSession(undefined)).rejects.toThrow('obrigatório');
  });

  it('rejeita refresh token desconhecido', async () => {
    await expect(refreshSession('token-que-nao-existe')).rejects.toThrow('Sessão inválida');
  });

  it('rejeita refresh token expirado', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const expiredToken = 'expired-raw-token';
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashRefreshToken(expiredToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(refreshSession(expiredToken)).rejects.toThrow('Sessão inválida');
  });

  it('rotaciona: emite par novo e marca o antigo como revogado', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const original = await issueTokens(user.id);

    const rotated = await refreshSession(original.refreshToken);

    expect(verifyAccessToken(rotated.accessToken).sub).toBe(user.id);
    expect(rotated.refreshToken).not.toBe(original.refreshToken);

    const originalRow = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, hashRefreshToken(original.refreshToken)),
    });
    expect(originalRow?.revokedAt).not.toBeNull();
  });

  it('detecta reuso de token já revogado e derruba todas as sessões do usuário', async () => {
    const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
    const sessionA = await issueTokens(user.id);
    const sessionB = await issueTokens(user.id);

    // Uso legítimo de A: gira normalmente.
    await refreshSession(sessionA.refreshToken);

    // Reuso do token A já revogado — sinal de roubo.
    await expect(refreshSession(sessionA.refreshToken)).rejects.toThrow('Sessão inválida');

    // Consequência: a sessão B, que nunca foi usada de forma
    // suspeita, também precisa estar revogada agora.
    const sessionBRow = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, hashRefreshToken(sessionB.refreshToken)),
    });
    expect(sessionBRow?.revokedAt).not.toBeNull();
    await expect(refreshSession(sessionB.refreshToken)).rejects.toThrow('Sessão inválida');
  });
});
