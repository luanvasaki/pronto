'use client';

import { useEffect } from 'react';
import { initSentry } from '../lib/sentry';

/** Inicializa o Sentry no client, uma vez. Não renderiza nada. */
export function InitSentry() {
  useEffect(() => {
    initSentry();
  }, []);

  return null;
}
