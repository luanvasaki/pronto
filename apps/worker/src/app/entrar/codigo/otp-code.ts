/** Código de verificação: sempre 6 dígitos, mesmo tamanho gerado pelo backend. */
export function isValidOtpCode(digits: string): boolean {
  return /^\d{6}$/.test(digits);
}
