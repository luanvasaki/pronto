'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError } from '@shift/shared';
import { Button } from '../../../components/ui/button';
import { Logo } from '../../../components/ui/logo';
import { uploadWorkerDocument, uploadWorkerSelfie } from '../../../lib/worker-profile-api';

export default function DocumentoPage() {
  const router = useRouter();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [selfieUploaded, setSelfieUploaded] = useState(false);

  const isValid = Boolean(documentFile && selfieFile);

  // Se a selfie falhar depois do documento já ter subido, tentar de novo
  // não pode reenviar o documento — cada envio cria uma linha nova (sem
  // upsert), e reenviar duplicaria o documento pendente de revisão.
  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      if (!documentUploaded) {
        await uploadWorkerDocument(documentFile!);
        setDocumentUploaded(true);
      }
      if (!selfieUploaded) {
        await uploadWorkerSelfie(selfieFile!);
        setSelfieUploaded(true);
      }
      router.push('/inicio');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar seus documentos.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Confirme sua identidade</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Precisamos do seu documento e de uma selfie do seu rosto, pra confirmar que é você mesmo.
          </p>
        </div>

        <div>
          <label
            htmlFor="document"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary transition hover:border-primary"
          >
            {documentFile ? documentFile.name : 'Toque para escolher uma foto ou PDF'}
            <input
              id="document"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1.5 text-xs text-text-secondary">Uma foto ou PDF do seu RG ou CNH.</p>
        </div>

        <div>
          <label
            htmlFor="selfie"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary transition hover:border-primary"
          >
            {selfieFile ? selfieFile.name : 'Toque para tirar ou escolher uma selfie'}
            <input
              id="selfie"
              type="file"
              accept="image/jpeg,image/png"
              capture="user"
              className="hidden"
              onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-1.5 text-xs text-text-secondary">
            Uma foto do seu rosto, pra comparar com o documento e confirmar que é você mesmo.
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Enviar
        </Button>
      </form>
    </main>
  );
}
