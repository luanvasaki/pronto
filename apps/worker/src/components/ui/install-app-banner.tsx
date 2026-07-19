'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'pronto:install-banner-dismissed';

function isIosDevice(): boolean {
  const ua = window.navigator.userAgent;
  // iPadOS 13+ se identifica como Macintosh, então distingue pelo touch.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Android/Chrome dispara `beforeinstallprompt` e instala com um toque.
 * iOS não expõe essa API (restrição da Apple) — lá só dá pra guiar o
 * usuário até Compartilhar → Adicionar à Tela de Início.
 */
export function InstallAppBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    if (isIosDevice()) {
      // setState assíncrono de propósito — evita disparar direto no corpo do efeito.
      queueMicrotask(() => setVisible(true));
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function onInstalled() {
      setVisible(false);
      localStorage.setItem(DISMISSED_KEY, '1');
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  async function handleInstallClick() {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      setInstallEvent(null);
      if (outcome === 'accepted') setVisible(false);
      else dismiss();
      return;
    }
    setShowIosSteps(true);
  }

  if (!visible) return null;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 7v6m0 0l-2.5-2.5M12 13l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-text">Instale o app Pronto</p>
          <p className="text-xs text-text-secondary">Acesso rápido, direto da tela inicial do celular.</p>
        </div>
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex-none rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-90"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar aviso de instalação"
          className="flex-none text-text-secondary hover:text-text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {showIosSteps && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-ios-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setShowIosSteps(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="install-ios-title" className="font-heading text-lg font-bold text-text">
              Instalar o app
            </p>
            <ol className="mt-4 space-y-3 text-left text-sm text-text-secondary">
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  1
                </span>
                Toque no ícone de compartilhar{' '}
                <svg
                  className="inline-block h-[1em] w-[1em] align-[-0.15em]"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>{' '}
                na barra do Safari.
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  2
                </span>
                Escolha &quot;Adicionar à Tela de Início&quot;.
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  3
                </span>
                Toque em &quot;Adicionar&quot; — pronto, o app fica no seu celular.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setShowIosSteps(false);
                dismiss();
              }}
              className="mt-6 w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-90"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
