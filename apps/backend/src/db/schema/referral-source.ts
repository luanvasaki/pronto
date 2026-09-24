import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * "Como você conheceu a Pronto?" — mesmo enum pros dois cadastros
 * (worker_profiles e companies), pra não duplicar o tipo Postgres.
 * Opcional nos dois: pergunta de marketing, não deveria travar
 * ninguém que não queira/saiba responder.
 */
export const referralSourceEnum = pgEnum('referral_source', [
  'instagram',
  'referral',
  'google_search',
  'other',
]);
