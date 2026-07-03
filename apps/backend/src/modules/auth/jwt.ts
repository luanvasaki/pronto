import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

const ACCESS_TOKEN_TTL = '15m';

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

/**
 * HS256 (segredo único) — não RS256/multi-chave, porque o backend é
 * um processo só (decisão de MVP). RS256 valeria a pena no dia em
 * que existir mais de um serviço validando token de forma
 * independente, não antes.
 */
export function signAccessToken(userId: string): string {
  const payload: Omit<AccessTokenPayload, never> = { sub: userId, type: 'access' };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (typeof decoded === 'string' || decoded.type !== 'access') {
    throw new Error('Token não é um access token válido.');
  }

  return decoded as AccessTokenPayload;
}
