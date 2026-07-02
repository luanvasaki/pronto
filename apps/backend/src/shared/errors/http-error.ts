/**
 * Erro base para qualquer falha que deveria virar uma resposta HTTP
 * com status diferente de 500. Módulos de domínio lançam subclasses
 * ou instâncias diretas disto em vez de `Error` genérico.
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
