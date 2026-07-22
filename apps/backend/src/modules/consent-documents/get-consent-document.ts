import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { consentDocuments, ConsentDocumentChapter } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

const VALID_TYPES = ['platform_terms', 'minors_opportunity', 'login_summary'] as const;
export type ConsentDocumentType = (typeof VALID_TYPES)[number];

export function isConsentDocumentType(value: string): value is ConsentDocumentType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

export interface ConsentDocumentResult {
  type: ConsentDocumentType;
  version: string;
  chapters: ConsentDocumentChapter[];
  declaration: string;
}

/**
 * Sempre a versão mais recente (maior `createdAt`) — nunca há UPDATE
 * numa linha existente (ver schema), então "mais recente" é sempre a
 * vigente. Getter usado tanto pelo endpoint público quanto por qualquer
 * lugar do backend que precise saber "qual é a versão de platform_terms
 * agora" (create-job.ts, create-application.ts, accept-terms.ts).
 */
export async function getLatestConsentDocument(type: ConsentDocumentType): Promise<ConsentDocumentResult> {
  const document = await db.query.consentDocuments.findFirst({
    where: eq(consentDocuments.type, type),
    orderBy: desc(consentDocuments.createdAt),
  });
  if (!document) {
    throw new HttpError(404, 'Documento de consentimento não encontrado.');
  }
  return {
    type: document.type,
    version: document.version,
    chapters: document.chapters,
    declaration: document.declaration,
  };
}
