import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { stripSslModeParam } from './src/db/strip-ssl-mode-param';

const databaseUrl = stripSslModeParam(process.env.DATABASE_URL as string);
const databaseHost = new URL(databaseUrl).hostname;
const isLocalHost = databaseHost === 'localhost' || databaseHost === '127.0.0.1';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    // `sslmode` saiu da URL (ver strip-ssl-mode-param.ts) — sem isso aqui,
    // o `drizzle-kit migrate` do deploy perde o único sinal que dizia pra
    // usar TLS e trava tentando conexão sem SSL num Postgres que exige,
    // sem erro nenhum, só "applying migrations..." até o Railway desistir.
    ssl: isLocalHost ? undefined : 'require',
  },
});
