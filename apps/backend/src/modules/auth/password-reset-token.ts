import { createHash, randomBytes } from 'node:crypto';

const RESET_TOKEN_BYTES = 32;

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** String opaca — não carrega claim nenhuma, só existe pra ser conferida no banco. */
export function generatePasswordResetToken(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

/** Nunca guardamos o token em claro — só o hash, mesmo padrão do refresh token. */
export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
