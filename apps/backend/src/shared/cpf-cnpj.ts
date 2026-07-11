/**
 * Validação de dígito verificador de verdade (algoritmo oficial da Receita),
 * não só contagem de dígitos — pega casos como "111.111.111-11" que têm o
 * tamanho certo mas nunca seriam um CPF/CNPJ emitido de verdade.
 *
 * Espelha `packages/shared/src/cpf-cnpj.ts` de propósito — o backend não
 * depende de `@shift/shared` (esse pacote é só pros frontends), então essa
 * cópia fica independente aqui em vez de criar uma dependência cruzada
 * entre os pacotes.
 */
function checkDigit(digits: string, weightsList: number[][]): boolean {
  for (const weights of weightsList) {
    const sum = weights.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0);
    const remainder = sum % 11;
    const expected = remainder < 2 ? 0 : 11 - remainder;
    if (expected !== Number(digits[weights.length])) {
      return false;
    }
  }
  return true;
}

const CPF_WEIGHTS = [
  [10, 9, 8, 7, 6, 5, 4, 3, 2],
  [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
];

/** `digits` já deve vir só com números (sem máscara). */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return checkDigit(digits, CPF_WEIGHTS);
}

const CNPJ_WEIGHTS = [
  [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
];

/** `digits` já deve vir só com números (sem máscara). */
export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  return checkDigit(digits, CNPJ_WEIGHTS);
}
