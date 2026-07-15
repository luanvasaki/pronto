'use client';

import { getCurrentUser, refreshSession } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface UseRedirectIfAuthenticatedResult {
  isChecking: boolean;
}

/**
 * Inverso do useRequireAuth: se já existe sessão válida, pula a tela de
 * login e manda direto pro app. Sem isso, quem reabre o app instalado
 * (start_url é /entrar) vê o formulário de login de novo mesmo já
 * estando logado — o app instalado devia abrir de volta de onde parou.
 */
export function useRedirectIfAuthenticated(redirectTo: string): UseRedirectIfAuthenticatedResult {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkSession(): Promise<void> {
      try {
        await getCurrentUser();
        router.replace(redirectTo);
        return;
      } catch {
        // Access token dura só 15min — antes de considerar que não há
        // sessão, tenta renovar com o refresh token (30 dias).
      }

      try {
        await refreshSession();
        await getCurrentUser();
        router.replace(redirectTo);
      } catch {
        setIsChecking(false);
      }
    }

    void checkSession();
    // Roda só uma vez, no mount — mesma justificativa do useRequireAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking };
}
