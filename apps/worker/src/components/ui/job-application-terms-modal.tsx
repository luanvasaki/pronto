'use client';

import { ConsentDocumentResponse, getConsentDocument } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { ConsentDocumentReader } from './consent-document-reader';

export interface JobApplicationTermsModalProps {
  onAccept: () => void;
  onClose: () => void;
}

// Capítulos 3 (natureza da intermediação) e 6 (cancelamentos/no-show) do
// mesmo platform_terms consolidado — recorte pra candidatura, sem
// documento próprio (ver docs/06-reference/backend-modules/workers.md).
const EXCERPT_CHAPTER_NUMBERS = ['3', '6'];

/**
 * Modal com o recorte do termo, aberto ao tocar "Ler termo e
 * candidatar-se" — substitui o checkbox inline que só tinha uma frase
 * solta. "Li e aceito" seta `termsConfirmed` (ver vaga/[id]/page.tsx) e
 * fecha; o botão "Aceitar escala" continua exatamente como já funcionava.
 */
export function JobApplicationTermsModal({ onAccept, onClose }: JobApplicationTermsModalProps) {
  const [document, setDocument] = useState<ConsentDocumentResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getConsentDocument('platform_terms')
      .then(setDocument)
      .catch(() => setLoadError(true));
  }, []);

  const excerptChapters = document?.chapters.filter((chapter) => EXCERPT_CHAPTER_NUMBERS.includes(chapter.number));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-background p-6 shadow-xl">
        <h2 className="font-heading text-lg font-bold text-text">Antes de se candidatar</h2>

        {loadError && <p className="text-sm text-danger">Não foi possível carregar o termo. Tente de novo.</p>}

        {excerptChapters && (
          <>
            <div className="max-h-[45vh] overflow-y-auto">
              <ConsentDocumentReader chapters={excerptChapters} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onAccept}>
                Li e aceito
              </Button>
              <Button type="button" variant="outlined" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
