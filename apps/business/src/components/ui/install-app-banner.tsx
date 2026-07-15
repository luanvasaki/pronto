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
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-lg" aria-hidden="true">
          📲
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-text">Instale o app Pronto Empresas</p>
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
          ✕
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
                Toque no ícone de compartilhar <span aria-hidden="true">⬆️</span> na barra do Safari.
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
