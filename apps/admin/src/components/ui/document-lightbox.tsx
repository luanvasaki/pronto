'use client';

import { useEffect, useState } from 'react';

export interface LightboxImage {
  url: string;
  alt: string;
}

/**
 * Documento de KYC precisa ser examinado em detalhe (comparar selfie
 * com foto do documento, ler dados pequenos) — sem isso o admin só
 * tinha a miniatura de 64px de altura pra decidir aprovar ou rejeitar.
 * Clique na imagem alterna entre "ajustar à tela" e "tamanho real, com
 * scroll" — dá zoom sem precisar de biblioteca externa de pan/pinch.
 * O fundo escuro (`bg-black/80`) e o texto branco são fixos, não
 * seguem os tokens de tema — é um overlay de "modo cinema" igual em
 * claro/escuro, não uma superfície do app.
 */
export function DocumentLightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black transition hover:bg-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className={isZoomed ? 'h-full w-full overflow-auto' : 'flex max-h-full max-w-full items-center justify-center'}>
        {/* eslint-disable-next-line @next/next/no-img-element -- vem de um blob: URL autenticado, next/image não se aplica */}
        <img
          src={image.url}
          alt={image.alt}
          onClick={(event) => {
            event.stopPropagation();
            setIsZoomed((current) => !current);
          }}
          className={
            isZoomed
              ? 'max-w-none cursor-zoom-out'
              : 'max-h-[85vh] max-w-[90vw] cursor-zoom-in rounded-lg object-contain'
          }
        />
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">
        Clique na imagem pra {isZoomed ? 'ajustar à tela' : 'ver em tamanho real'} · Esc pra fechar
      </p>
    </div>
  );
}
