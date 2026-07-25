'use client';

import { ApiError, getCurrentUser, refreshSession } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface UseRequireAuthResult {
  isChecking: boolean;
}

/**
 * Access token dura só 15min. Além do apiFetch já tentar renovar sozinho
 * num 401 (ver packages/shared/src/api.ts), essa renovação proativa
 * cobre quem fica com o app aberto e navegando por muito tempo sem dar
 * reload — sem isso, a próxima chamada de API só encontraria o token
 * vencido de forma reativa.
 */
const SILENT_REFRESH_INTERVAL_MS = 10 * 60_000;

/**
 * Só um 401 (a API respondendo "sua sessão não vale mais", mesmo depois
 * da tentativa de renovação automática do apiFetch) significa de fato
 * sessão expirada. Qualquer outra coisa — falha de rede, DNS, timeout —
 * é transitório: numa conexão de celular instável isso aconteceria toda
 * hora, e deslogar quem tem sessão válida por causa disso é pior que só
 * deixar a checagem falhar silenciosamente.
 */
function isSessionInvalid(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Mesma checagem usada pelos apps business e worker (apps/business/src/hooks/use-require-auth.ts). */
export function useRequireAuth(): UseRequireAuthResult {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function checkSession(): Promise<void> {
      try {
        await getCurrentUser();
        if (cancelled) return;
        setIsChecking(false);
        intervalId = setInterval(() => {
          refreshSession().catch(() => undefined);
        }, SILENT_REFRESH_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        if (isSessionInvalid(err)) {
          router.replace('/entrar');
        } else {
          setIsChecking(false);
        }
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // Roda só uma vez, no mount — não em toda mudança de `router`
    // (que na prática nem muda de referência entre renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isChecking };
}
