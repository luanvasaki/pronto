const NON_DIGIT = /\D/g;

/** O que o usuário digita vira só números — máscara fica pra depois, se precisar. */
export function extractDigits(raw: string): string {
  return raw.replace(NON_DIGIT, '');
}

/** Celular brasileiro: DDD (2) + número (8 ou 9 dígitos). */
export function isValidBrazilianPhone(digits: string): boolean {
  return /^\d{10,11}$/.test(digits);
}

/** Formato que o backend espera (E.164) — só Brasil por enquanto, sem seletor de país. */
export function toE164(digits: string): string {
  return `+55${digits}`;
}
