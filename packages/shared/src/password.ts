const MIN_PASSWORD_LENGTH = 8;

/** Mesma regra mínima do backend (auth/password.ts) — placar de UI, não a fonte da verdade. */
export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
