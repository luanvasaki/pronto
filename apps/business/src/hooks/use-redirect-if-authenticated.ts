'use client';

import { getCurrentUser } from '@shift/shared';
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
 *
 * Não precisa renovar sessão na mão aqui — o apiFetch já tenta sozinho
 * num 401 (ver packages/shared/src/api.ts) antes de propagar o erro.
 */
export function useRedirectIfAuthenticated(redirectTo: string): UseRedirectIfAuthenticatedResult {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then(() => {
        if (!cancelled) router.replace(redirectTo);
      })
      .catch(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
    // Roda só uma vez, no mount — mesma justificativa do useRequireAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking };
}
