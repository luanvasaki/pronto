import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { loginConsents } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { getLatestConsentDocument } from '../consent-documents/get-consent-document';

export interface AcceptLoginTermsResult {
  version: string;
}

/**
 * Aceite do "Termo Resumido de Ciência e Utilização" — roda independente
 * do aceite do documento completo (`acceptTerms`), uma vez por versão
 * (ver login_consents.userVersionUnique). Mostrado como modal bloqueante
 * dentro do app, não como tela de navegação própria.
 */
export async function acceptLoginTerms(
  userId: string,
  version: string | undefined,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<AcceptLoginTermsResult> {
  if (!version) {
    throw new HttpError(400, 'Versão do termo é obrigatória.');
  }

  const latest = await getLatestConsentDocument('login_summary');
  if (version !== latest.version) {
    throw new HttpError(409, 'A versão do termo mudou — recarregue a página antes de aceitar.');
  }

  const existing = await db.query.loginConsents.findFirst({
    where: and(eq(loginConsents.userId, userId), eq(loginConsents.version, latest.version)),
  });
  if (existing) {
    return { version: latest.version };
  }

  await db.insert(loginConsents).values({ userId, version: latest.version, ipAddress, userAgent });
  return { version: latest.version };
}
