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

function readDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    throw new Error('DATABASE_URL não definida. Veja apps/backend/.env.example.');
  }

  return raw;
}

function readJwtSecret(): string {
  const raw = process.env.JWT_SECRET;

  if (!raw) {
    throw new Error('JWT_SECRET não definida. Veja apps/backend/.env.example.');
  }

  return raw;
}

function readCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;

  if (!raw) {
    throw new Error('CORS_ORIGINS não definida. Veja apps/backend/.env.example.');
  }

  return raw.split(',').map((origin) => origin.trim());
}

export const env = {
  port: readPort(),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: readDatabaseUrl(),
  jwtSecret: readJwtSecret(),
  corsOrigins: readCorsOrigins(),
};
