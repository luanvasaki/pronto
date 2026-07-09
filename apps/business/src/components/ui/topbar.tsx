'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface PendingApplicationNotification {
  applicationId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
}

export interface TopbarProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  pendingApplicationsCount?: number;
  pendingApplications?: PendingApplicationNotification[];
}

/**
 * Sino mostra candidaturas pendentes de revisão (ainda não
 * aprovadas/rejeitadas) em qualquer vaga da empresa — não precisa de
 * campo "lido" separado, porque sair do "pending" já tira do contador
 * (e da lista) sozinho. Clicar abre um dropdown com quem se
 * candidatou; cada item leva pra tela de candidatos da vaga.
 *
 * "Publicar turno" navega pra /vagas/nova; virar modal fica pra uma
 * próxima etapa.
 *
 * Hambúrguer só existe abaixo de `lg` — acima disso a Sidebar já
 * fica sempre visível (ver sidebar.tsx).
 */
export function Topbar({
  title,
  subtitle,
  onMenuClick,
  pendingApplicationsCount = 0,
  pendingApplications = [],
}: TopbarProps) {
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
    <div className="flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-border lg:hidden"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="truncate font-heading text-xl leading-none font-bold tracking-[-0.01em] text-text">
            {title}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-text-secondary">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3.5">
        <div ref={notificationsRef} className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((current) => !current)}
            aria-label={
              pendingApplicationsCount > 0
                ? `${pendingApplicationsCount} candidatura(s) aguardando resposta`
                : 'Notificações'
            }
            className={`relative flex h-10 w-10 items-center justify-center rounded-[11px] border transition ${
              pendingApplicationsCount > 0 ? 'border-danger bg-danger/10 text-danger' : 'border-border text-text'
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
            {pendingApplicationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {pendingApplicationsCount > 9 ? '9+' : pendingApplicationsCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute top-12 right-0 z-50 max-h-80 w-80 overflow-y-auto rounded-2xl border border-border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
              {pendingApplications.length === 0 ? (
                <p className="p-4 text-sm text-text-secondary">Nenhuma candidatura aguardando resposta.</p>
              ) : (
                <ul>
                  {pendingApplications.map((notification) => (
                    <li key={notification.applicationId} className="border-b border-border last:border-b-0">
                      <Link
                        href={`/vagas/${notification.jobId}`}
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-3.5 text-sm text-text transition hover:bg-background"
                      >
                        <span className="font-semibold">{notification.workerName}</span> se inscreveu na vaga de{' '}
                        {notification.categoryName}.
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <Link
          href="/vagas/nova"
          className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-3 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(245,83,30,0.28)] transition hover:brightness-90 lg:px-5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">Publicar turno</span>
        </Link>
      </div>
    </div>
  );
}
