'use client';

import { useEffect } from 'react';

/** Registra o service worker no client. Não renderiza nada. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return null;
}
