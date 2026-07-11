/** CPF: só formato (11 dígitos), sem validar dígito verificador — isso fica pro backend. */
export function isValidCpf(digits: string): boolean {
  return /^\d{11}$/.test(digits);
}
