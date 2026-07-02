/**
 * Único ponto de leitura de variáveis de ambiente do backend.
 * Nenhum outro arquivo deve ler `process.env` diretamente — assim,
 * quando uma variável nova for necessária, este é o único lugar que muda.
 */

function readPort(): number {
  const raw = process.env.PORT ?? '3000';
  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    throw new Error(`PORT inválida: "${raw}" não é um número.`);
  }

  return parsed;
}

export const env = {
  port: readPort(),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
