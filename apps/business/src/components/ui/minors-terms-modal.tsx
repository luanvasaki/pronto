'use client';

import { ApiError, ConsentDocumentResponse, getConsentDocument } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { ConsentDocumentReader } from './consent-document-reader';

export interface MinorsTermsModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Mostrado quando a empresa liga "disponível pra menores de idade" numa
 * vaga (nova ou edição) — termo específico (consent_documents type
 * 'minors_opportunity'), separado do termo geral já aceito no cadastro.
 * "Cancelar" desliga o toggle de novo (ver vagas/nova e vagas/[id]/editar),
 * já que sem aceitar esse termo a vaga não pode ficar habilitada pra menores.
 */
export function MinorsTermsModal({ onAccept, onCancel }: MinorsTermsModalProps) {
  const [document, setDocument] = useState<ConsentDocumentResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConsentDocument('minors_opportunity')
      .then(setDocument)
      .catch(() => setLoadError(true));
  }, []);

  function handleAccept(): void {
    if (!document) return;
    setError(null);
    try {
      onAccept();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar o aceite.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-background p-6 shadow-xl">
        <div>
          <h2 className="font-heading text-lg font-bold text-text">Habilitar candidaturas de 16-17 anos</h2>
        </div>

        {loadError && <p className="text-sm text-danger">Não foi possível carregar o termo. Tente de novo.</p>}

        {document && (
          <>
            <div className="max-h-[45vh] overflow-y-auto">
              <ConsentDocumentReader chapters={document.chapters} declaration={document.declaration} />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleAccept}>
                Li e aceito
              </Button>
              <Button type="button" variant="outlined" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
