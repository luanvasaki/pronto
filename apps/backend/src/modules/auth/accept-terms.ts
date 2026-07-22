import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { getLatestConsentDocument } from '../consent-documents/get-consent-document';

export interface AcceptTermsResult {
  termsVersion: string;
}

/**
 * Tela cheia de `/cadastro/termos` chama isso depois que o usuário rola
 * o documento inteiro e marca "Li e aceito" — grava versão + IP +
 * user-agent no momento exato do aceite (evidência exigida pelo próprio
 * Termo, seção "Evidência do aceite"). `version` vem do front pra
 * garantir que o que a pessoa aceitou é exatamente o que o servidor
 * acha que é a versão vigente — se divergir (documento mudou enquanto a
 * tela estava aberta), rejeita em vez de gravar aceite de uma versão
 * que já não é mais a atual.
 */
export async function acceptTerms(
  userId: string,
  version: string | undefined,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<AcceptTermsResult> {
  if (!version) {
    throw new HttpError(400, 'Versão do termo é obrigatória.');
  }

  const latest = await getLatestConsentDocument('platform_terms');
  if (version !== latest.version) {
    throw new HttpError(409, 'A versão do termo mudou — recarregue a página antes de aceitar.');
  }

  const [updated] = await db
    .update(users)
    .set({
      termsAcceptedAt: new Date(),
      termsVersion: latest.version,
      termsIpAddress: ipAddress,
      termsUserAgent: userAgent,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }

  return { termsVersion: updated.termsVersion! };
}
