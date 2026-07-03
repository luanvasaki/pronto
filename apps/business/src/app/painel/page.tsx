'use client';

import { getCurrentUser, refreshSession } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PainelPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkSession(): Promise<void> {
      try {
        await getCurrentUser();
        setIsChecking(false);
        return;
      } catch {
        // Access token dura só 15min — antes de considerar a sessão
        // inválida, tenta renovar com o refresh token (30 dias).
      }

      try {
        await refreshSession();
        await getCurrentUser();
        setIsChecking(false);
      } catch {
        router.replace('/entrar');
      }
    }

    void checkSession();
    // Roda só uma vez, no mount — não em toda mudança de `router`
    // (que na prática nem muda de referência entre renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isChecking) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Confirmando sua sessão...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 text-center">
      <p className="text-lg text-text-secondary">
        Login confirmado! Em breve, o painel de vagas e candidatos aparece aqui.
      </p>
    </main>
  );
}
