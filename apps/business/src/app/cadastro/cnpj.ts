/** CNPJ: só formato (14 dígitos), sem validar dígito verificador — isso fica pro backend. */
export function isValidCnpj(digits: string): boolean {
  return /^\d{14}$/.test(digits);
}
