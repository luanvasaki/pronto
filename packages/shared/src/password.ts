const MIN_PASSWORD_LENGTH = 8;
// bcrypt trunca (ignora) qualquer byte além do 72º em silêncio — mesmo
// limite do backend (auth/password.ts), senão uma senha longa passa na
// validação do front e só falha depois do round-trip ao backend.
const MAX_PASSWORD_LENGTH = 72;

/** Mesma regra do backend (auth/password.ts) — placar de UI, não a fonte da verdade. */
export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
