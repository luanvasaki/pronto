import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

/**
 * Postgres local (Homebrew) não fala TLS — só bancos remotos (Neon,
 * RDS...) precisam disso. Decide pelo host em vez de por NODE_ENV pra
 * não depender de lembrar de setar a env certa: qualquer host que não
 * seja a própria máquina já entra com SSL.
 */
function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

const databaseHost = new URL(env.databaseUrl).hostname;
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isLocalHost(databaseHost) ? undefined : { rejectUnauthorized: true },
});

/** Instância única do Drizzle — repositórios importam isso, nada mais. */
export const db = drizzle(pool, { schema });

/** Fecha o pool — usado por scripts de uma execução só (seed, etc.). */
export async function closeDb(): Promise<void> {
  await pool.end();
}
