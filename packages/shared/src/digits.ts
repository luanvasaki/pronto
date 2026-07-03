const NON_DIGIT = /\D/g;

/** O que o usuário digita vira só números — usado por qualquer campo numérico do app. */
export function extractDigits(raw: string): string {
  return raw.replace(NON_DIGIT, '');
}
