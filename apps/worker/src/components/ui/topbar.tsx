'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './logo';

export interface CalledNotification {
  id: string;
  message: string;
  href: string;
}

export interface TopbarProps {
  calledCount: number;
  calledNotifications?: CalledNotification[];
}

/**
 * Sino avisa quantas novidades ainda não foram vistas — candidatura
 * aprovada/removida (mesmos alertas dos banners na tela de Início) e
 * escala concluída esperando avaliação (banner da Agenda) — clicar
 * abre um dropdown; cada item leva pro `href` da própria notificação
 * (Início ou Agenda, dependendo do tipo).
 */
export function Topbar({ calledCount, calledNotifications = [] }: TopbarProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-sm">
      <Link href="/inicio" aria-label="Ir para o início">
        <Logo />
      </Link>
      <div ref={notificationsRef} className="relative">
        <button
          type="button"
          onClick={() => setIsNotificationsOpen((current) => !current)}
          aria-label={calledCount > 0 ? `${calledCount} chamada(s) pra trabalhar` : 'Notificações'}
          className={`relative flex h-10 w-10 items-center justify-center rounded-[11px] border transition ${
            calledCount > 0 ? 'border-danger bg-danger/10 text-danger' : 'border-border text-text'
          }`}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="2" />
          </svg>
          {calledCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {calledCount > 9 ? '9+' : calledCount}
            </span>
          )}
        </button>

        {isNotificationsOpen && (
          <div className="absolute top-12 right-0 z-50 max-h-80 w-72 overflow-y-auto rounded-2xl border border-border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
            {calledNotifications.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">Nenhuma novidade por enquanto.</p>
            ) : (
              <ul>
                {calledNotifications.map((notification) => (
                  <li key={notification.id} className="border-b border-border last:border-b-0">
                    <Link
                      href={notification.href}
                      onClick={() => setIsNotificationsOpen(false)}
                      className="block p-3.5 text-sm text-text transition hover:bg-background"
                    >
                      {notification.message}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
