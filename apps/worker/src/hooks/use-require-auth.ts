'use client';

import { getCurrentUser, refreshSession } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface UseRequireAuthResult {
  isChecking: boolean;
}

/** Mesma checagem usada pelo app business (apps/business/src/hooks/use-require-auth.ts). */
export function useRequireAuth(): UseRequireAuthResult {
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

  return { isChecking };
}
