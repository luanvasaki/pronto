'use client';

import { acceptLoginTerms, ApiError, ConsentDocumentResponse, getConsentDocument } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { ConsentDocumentReader } from './consent-document-reader';

export interface LoginTermsModalProps {
  onAccepted: () => void;
}

/**
 * Overlay bloqueante mostrado uma vez por versão do Termo Resumido de
 * Ciência (independente do aceite do documento completo no cadastro,
 * ver docs/06-reference/backend-modules/workers.md) — diferente do
 * VerificationBanner (dispensável), este trava a interação com o resto
 * do app até "Li e aceito" ser clicado.
 */
export function LoginTermsModal({ onAccepted }: LoginTermsModalProps) {
  const [document, setDocument] = useState<ConsentDocumentResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConsentDocument('login_summary')
      .then(setDocument)
      .catch(() => setLoadError(true));
  }, []);

  async function handleAccept(): Promise<void> {
    if (!document || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await acceptLoginTerms(document.version);
      onAccepted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar seu aceite.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-background p-6 shadow-xl">
        <div>
          <h2 className="font-heading text-lg font-bold text-text">Antes de continuar</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Confirme que está ciente das regras essenciais de uso da Pronto.
          </p>
        </div>

        {loadError && <p className="text-sm text-danger">Não foi possível carregar o termo. Tente de novo.</p>}

        {document && (
          <>
            <div className="max-h-[45vh] overflow-y-auto">
              <ConsentDocumentReader chapters={document.chapters} declaration={document.declaration} />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="button" isLoading={isSubmitting} onClick={handleAccept}>
              Li e aceito, entendi
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
