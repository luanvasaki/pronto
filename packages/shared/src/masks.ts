/**
 * Aplica a máscara visual progressivamente, conforme os dígitos vão
 * aparecendo — o valor guardado no estado continua sendo só os
 * dígitos (extractDigits), isso aqui é só pra exibição no input.
 */
export function formatCpf(digits: string): string {
  return digits
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCnpj(digits: string): string {
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** Celular (11 dígitos, 9 na frente) ou fixo (10 dígitos) — os dois formatam certo pela mesma regra. */
export function formatPhone(digits: string): string {
  return digits
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
}

export function formatCep(digits: string): string {
  return digits.slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}
