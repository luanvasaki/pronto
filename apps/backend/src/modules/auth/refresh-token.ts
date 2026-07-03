import { createHash, randomBytes } from 'node:crypto';

const REFRESH_TOKEN_BYTES = 32;

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** String opaca — não carrega claim nenhuma, só existe pra ser conferida no banco. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

/** Nunca guardamos o token em claro — só o hash, mesmo padrão de qualquer segredo. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
