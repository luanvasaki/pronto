'use client';

import { ApiError, getCurrentUser, refreshSession } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface UseRequireAuthResult {
  isChecking: boolean;
}

/**
 * Só um 401 (a API respondendo "sua sessão não vale mais") significa
 * de fato sessão expirada. Qualquer outra coisa — falha de rede, DNS,
 * timeout — é transitório: numa conexão de celular instável isso
 * aconteceria toda hora, e deslogar quem tem sessão válida por causa
 * disso é pior que só deixar a checagem falhar silenciosamente.
 */
function isSessionInvalid(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
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
      } catch (err) {
        if (!isSessionInvalid(err)) {
          // Erro de rede/servidor, não de autenticação — não desloga
          // quem provavelmente ainda tem sessão válida. O usuário
          // segue na tela e pode tentar de novo (reload, nova ação).
          setIsChecking(false);
          return;
        }
        // Access token dura só 15min — antes de considerar a sessão
        // inválida, tenta renovar com o refresh token (30 dias).
      }

      try {
        await refreshSession();
        await getCurrentUser();
        setIsChecking(false);
      } catch (err) {
        if (isSessionInvalid(err)) {
          router.replace('/entrar');
        } else {
          setIsChecking(false);
        }
      }
    }

    void checkSession();
    // Roda só uma vez, no mount — não em toda mudança de `router`
    // (que na prática nem muda de referência entre renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking };
}
