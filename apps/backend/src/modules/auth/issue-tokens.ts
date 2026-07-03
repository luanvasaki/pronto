import { db } from '../../db/client';
import { refreshTokens } from '../../db/schema';
import { signAccessToken } from './jwt';
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from './refresh-token';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/** Chamado sempre que uma sessão nasce (hoje: só depois de OTP validado). */
export async function issueTokens(userId: string): Promise<IssuedTokens> {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshToken };
}
