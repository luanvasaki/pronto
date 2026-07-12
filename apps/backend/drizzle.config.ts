import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { stripSslModeParam } from './src/db/strip-ssl-mode-param';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: stripSslModeParam(process.env.DATABASE_URL as string),
  },
});
