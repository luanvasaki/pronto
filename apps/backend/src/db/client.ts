import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

const pool = new Pool({ connectionString: env.databaseUrl });

/** Instância única do Drizzle — repositórios importam isso, nada mais. */
export const db = drizzle(pool, { schema });
