import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';
import { stripSslModeParam } from './strip-ssl-mode-param';

/**
 * Postgres local (Homebrew) não fala TLS — só bancos remotos (Neon,
 * RDS...) precisam disso. Decide pelo host em vez de por NODE_ENV pra
 * não depender de lembrar de setar a env certa: qualquer host que não
 * seja a própria máquina já entra com SSL.
 */
function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

const databaseUrl = stripSslModeParam(env.databaseUrl);
const databaseHost = new URL(databaseUrl).hostname;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalHost(databaseHost) ? undefined : { rejectUnauthorized: true },
});

/** Instância única do Drizzle — repositórios importam isso, nada mais. */
export const db = drizzle(pool, { schema });

/** Fecha o pool — usado por scripts de uma execução só (seed, etc.). */
export async function closeDb(): Promise<void> {
  await pool.end();
}
