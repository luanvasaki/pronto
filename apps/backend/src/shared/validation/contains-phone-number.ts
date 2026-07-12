// Sequências de dígitos com separadores comuns (espaço, ponto, traço,
// parênteses) no meio — captura formatos tipo "(11) 91234-5678",
// "11 9 1234 5678", "11912345678", "+55 11 91234-5678".
const PHONE_LIKE_REGEX = /\d[\d\s.\-()]{6,}\d/g;

/**
 * Heurística, não detecção perfeita: qualquer sequência de 9 a 13
 * dígitos (celular/fixo com DDD até celular com código do país) conta
 * como telefone. O piso em 9 (em vez de 8) evita marcar datas
 * dd/mm/aaaa (8 dígitos concatenados) como falso positivo. Como o
 * pedido é bloqueio estrito — nenhum telefone deve passar — prefere
 * over-block a deixar escapar.
 */
export function containsPhoneNumber(text: string): boolean {
  const matches = text.match(PHONE_LIKE_REGEX) ?? [];
  return matches.some((match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 13;
  });
}
