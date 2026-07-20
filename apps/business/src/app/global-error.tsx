'use client';

import { useEffect } from 'react';
import { Sentry } from '../lib/sentry';

/**
 * Substitui o root layout inteiro quando um erro escapa de todos os
 * error boundaries — por isso precisa do próprio <html>/<body>. É o
 * único lugar que pega crash de render fora do que já é tratado
 * localmente (ex: fetch com try/catch nas páginas).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-full flex flex-col items-center justify-center gap-4 p-6 text-center bg-[var(--color-background)] text-[var(--color-text)]">
        <p className="text-base font-medium">Algo deu errado.</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Tenta recarregar a página. Se continuar acontecendo, avisa a gente.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
