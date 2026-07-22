import { jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

// 'platform_terms' = Termos, Políticas e Regras de Uso (documento consolidado
// de 12 capítulos, mostrado inteiro no cadastro e usado como versão canônica
// em jobs/applications). 'minors_opportunity' = termo que a empresa aceita
// por vaga ao habilitar candidaturas de 16-17 anos (ver jobs.minorsAllowed).
// 'login_summary' = termo resumido de ciência mostrado uma vez no login,
// independente do aceite do cadastro (ver login_consents).
export const consentDocumentTypeEnum = pgEnum('consent_document_type', [
  'platform_terms',
  'minors_opportunity',
  'login_summary',
]);

export interface ConsentDocumentChapter {
  number: string;
  heading: string;
  body: string;
}

/**
 * Texto jurídico versionado — nunca dá UPDATE numa linha existente, uma
 * versão nova é sempre uma linha nova (mesmo espírito de "reenviar
 * documento" já usado no resto do projeto: histórico preservado pra
 * sempre, pra provar o que exatamente um usuário aceitou numa data
 * específica). Ver seed-consent-documents.ts pra como popular.
 */
export const consentDocuments = pgTable(
  'consent_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: consentDocumentTypeEnum('type').notNull(),
    version: varchar('version', { length: 20 }).notNull(),
    chapters: jsonb('chapters').notNull().$type<ConsentDocumentChapter[]>(),
    // Bloco de "declaração final de aceite" (lista de "☐ Compreendi que...")
    // — mostrado junto do checkbox final, separado dos capítulos porque
    // não tem número/heading próprio no documento original.
    declaration: text('declaration').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeVersionUnique: uniqueIndex('consent_documents_type_version_unique').on(table.type, table.version),
  }),
);
