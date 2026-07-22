'use client';

import { acceptTerms, ApiError, ConsentDocumentResponse, getConsentDocument } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ConsentDocumentReader } from '../../../components/ui/consent-document-reader';
import { Logo } from '../../../components/ui/logo';

/**
 * Tela cheia mostrada uma vez, logo depois de criar a conta (e também
 * pra quem já tem conta mas ainda não aceitou a versão vigente — ver o
 * gate em (app)/layout.tsx) — documento inteiro, capítulos separados,
 * só libera "Avançar" com o checkbox marcado.
 */
export default function CadastroTermosPage() {
  const router = useRouter();
  const [document, setDocument] = useState<ConsentDocumentResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConsentDocument('platform_terms')
      .then(setDocument)
      .catch(() => setLoadError(true));
  }, []);

  async function handleAdvance(): Promise<void> {
    if (!document || !accepted || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await acceptTerms(document.version);
      router.push('/cadastro');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar seu aceite.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-lg flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Boas-vindas à Pronto!</h1>
          <p className="mt-1 text-[16px] text-text-secondary">
            Antes de continuar, leia os Termos, Políticas e Regras de Uso da plataforma.
          </p>
        </div>

        {loadError && (
          <p className="text-sm text-danger">Não foi possível carregar o termo. Recarregue a página.</p>
        )}

        {document && (
          <>
            <div className="max-h-[50vh] overflow-y-auto">
              <ConsentDocumentReader chapters={document.chapters} declaration={document.declaration} />
            </div>

            <label className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface p-4 text-sm text-text">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              Li e aceito os Termos, Políticas e Regras de Uso da Pronto (versão {document.version}).
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="button" disabled={!accepted} isLoading={isSubmitting} onClick={handleAdvance}>
              Avançar
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
