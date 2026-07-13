import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// NÃO usar stripSslModeParam aqui: tirar o sslmode da URL faz o
// `drizzle-kit migrate` do deploy travar tentando conexão sem TLS num
// Postgres gerenciado que exige SSL — sem erro nenhum, só preso em
// "applying migrations..." até o Railway desistir. O aviso de depreciação
// do pg-connection-string é só ruído nos logs; melhor isso do que o
// deploy inteiro travado. db/client.ts continua usando stripSslModeParam
// normalmente — lá o ssl já é decidido explícito, sem depender da URL.
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
