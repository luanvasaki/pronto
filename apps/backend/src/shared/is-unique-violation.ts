/**
 * Traduz uma violação de índice único do Postgres (código 23505) — usado
 * pra fechar a corrida entre duas requisições simultâneas tentando criar
 * o mesmo registro (candidatura duplicada, categoria duplicada, avaliação
 * duplicada, conta duplicada): a checagem de "já existe?" antes do insert
 * não fecha essa corrida sozinha, só o índice único do banco fecha de
 * verdade; isto aqui só traduz o erro cru pra uma mensagem amigável.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const causeCode = (error.cause as { code?: unknown } | undefined)?.code;
  return code === '23505' || causeCode === '23505';
}
