import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { loginConsents, users } from '../../db/schema';
import { getLatestConsentDocument } from '../consent-documents/get-consent-document';

export interface ConsentStatus {
  /** `true` quando o usuário nunca aceitou (ou aceitou uma versão antiga de) platform_terms. */
  needsTermsAcceptance: boolean;
  hasAcceptedLoginTerms: boolean;
}

/**
 * Se nenhum documento foi publicado ainda (`consent_documents` vazia —
 * ambiente novo, seed ainda não rodou), não tem o que exigir: os dois
 * gates ficam abertos (`false`/`true`) em vez de quebrar o carregamento
 * do perfil inteiro por causa de um 404 de documento inexistente.
 */
async function getLatestVersionOrNull(type: Parameters<typeof getLatestConsentDocument>[0]): Promise<string | null> {
  try {
    const document = await getLatestConsentDocument(type);
    return document.version;
  } catch {
    return null;
  }
}

/**
 * Usado pelo `(app)/layout.tsx` de business e worker (via
 * getCompanyProfile/getWorkerProfile) pra decidir se redireciona pra
 * `/cadastro/termos` ou mostra o modal de login. Mesma checagem serve
 * pra conta nova (nunca aceitou nada) e conta antiga (aceitou uma
 * versão que não é mais a vigente — ver módulo 24.2 do Termo, que exige
 * novo aceite quando a mudança é relevante).
 */
export async function getConsentStatus(userId: string): Promise<ConsentStatus> {
  const [user, latestTermsVersion, latestLoginSummaryVersion] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    getLatestVersionOrNull('platform_terms'),
    getLatestVersionOrNull('login_summary'),
  ]);

  const needsTermsAcceptance = latestTermsVersion !== null && user?.termsVersion !== latestTermsVersion;

  if (latestLoginSummaryVersion === null) {
    return { needsTermsAcceptance, hasAcceptedLoginTerms: true };
  }

  const loginConsent = await db.query.loginConsents.findFirst({
    where: and(eq(loginConsents.userId, userId), eq(loginConsents.version, latestLoginSummaryVersion)),
  });

  return { needsTermsAcceptance, hasAcceptedLoginTerms: Boolean(loginConsent) };
}
