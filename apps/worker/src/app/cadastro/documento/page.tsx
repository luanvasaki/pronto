'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError } from '@shift/shared';
import { Button } from '../../../components/ui/button';
import { Logo } from '../../../components/ui/logo';
import { uploadWorkerDocument } from '../../../lib/worker-profile-api';

export default function DocumentoPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await uploadWorkerDocument(file);
      router.push('/inicio');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o documento.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Envie seu documento</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Uma foto ou PDF do seu RG ou CNH, pra confirmarmos sua identidade.
          </p>
        </div>

        <label
          htmlFor="document"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary transition hover:border-primary"
        >
          {file ? file.name : 'Toque para escolher uma foto ou PDF'}
          <input
            id="document"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!file} isLoading={isSubmitting}>
          Enviar
        </Button>
      </form>
    </main>
  );
}
