import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Testes sempre usam LocalFileStorage — mesmo com tokens reais do Vercel
// Blob no .env (necessários pro `npm run dev`), a suíte não pode depender de
// rede nem deixar arquivo de teste no Blob de verdade.
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_DOCUMENTS_TOKEN;
// Mesmo motivo: sem isso, testes de forgot-password/Google mandariam
// e-mail de verdade via Resend ou bateriam na API real do Google.
delete process.env.RESEND_API_KEY;
delete process.env.GOOGLE_CLIENT_ID;

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/test-global-setup.ts'],
    include: ['src/**/*.test.ts'],
    // Todo teste bate no mesmo Postgres (sem schema isolado por
    // arquivo) — rodar os arquivos em paralelo deixava alguns poucos
    // testes instáveis: fixture com o mesmo telefone/CNPJ reaproveitada
    // sem querer entre dois arquivos diferentes, ou uma métrica global
    // (ex.: getAdminMetrics) lendo uma linha que outro arquivo ainda
    // não tinha limpado no afterEach. Sequencial é mais lento, mas sem
    // esse tipo de falso-negativo no CI.
    fileParallelism: false,
  },
});
