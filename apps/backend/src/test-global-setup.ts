import { closeDb } from './db/client';
import { seedConsentDocuments } from './db/seed-consent-documents';

/**
 * Roda uma vez antes de qualquer arquivo de teste (`globalSetup` do
 * Vitest, processo/módulo separado dos workers de teste) — garante que
 * `consent_documents` tem pelo menos uma versão de cada tipo antes da
 * suíte rodar. Sem isso, `createJob`/`createApplication`/`acceptTerms`
 * (que dependem de `getLatestConsentDocument`) quebrariam em qualquer
 * ambiente que só roda `drizzle-kit migrate` sem rodar o seed manual
 * depois (é exatamente o caso do CI, ver .github/workflows/backend-ci.yml).
 * Idempotente — pula qualquer (type, version) que já exista.
 */
export async function setup(): Promise<void> {
  await seedConsentDocuments();
  await closeDb();
}
