'use client';

import { useState } from 'react';
import { DocumentLightbox } from './document-lightbox';

export interface ZoomableDocumentImageProps {
  src: string;
  alt: string;
  /** Classes da miniatura (tamanho/borda) — a versão ampliada no lightbox tem seu próprio tamanho fixo. */
  className?: string;
}

export function ZoomableDocumentImage({ src, alt, className = '' }: ZoomableDocumentImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Ampliar ${alt}`}
        className="group relative inline-block cursor-zoom-in rounded-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- vem de um blob: URL autenticado, next/image não se aplica */}
        <img src={src} alt={alt} className={`object-contain ${className}`} />
        <span className="absolute right-1.5 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {isOpen && <DocumentLightbox image={{ url: src, alt }} onClose={() => setIsOpen(false)} />}
    </>
  );
}
