'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './avatar';

export interface PendingWorkerNotification {
  workerId: string;
  workerFullName: string;
}

export interface PendingCompanyNotification {
  companyId: string;
  tradeName: string;
}

export interface PendingCategoryNotification {
  categoryId: string;
  name: string;
}

export interface TopbarProps {
  title: string;
  adminName: string;
  adminPhotoUrl?: string | null;
  onMenuClick: () => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
  pendingWorkers?: PendingWorkerNotification[];
  pendingCompanies?: PendingCompanyNotification[];
  pendingCategories?: PendingCategoryNotification[];
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Mesmo padrão do Topbar do business (avatar + saudação + sino em
 * dropdown) — antes o admin só tinha um link puro pro sino, sem
 * saudação nem avatar de quem está logado, a única divergência visual
 * entre os 3 apps. Todo item do dropdown leva pra `/admin/verificacoes`
 * (a fila inteira) — a tela não tem âncora por item individual ainda,
 * então não dá pra linkar mais fundo que isso, diferente do sino do
 * business (que linka direto pra vaga de cada notificação).
 */
export function Topbar({
  title,
  adminName,
  adminPhotoUrl = null,
  onMenuClick,
  onLogout,
  isLoggingOut = false,
  pendingWorkers = [],
  pendingCompanies = [],
  pendingCategories = [],
}: TopbarProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const totalCount = pendingWorkers.length + pendingCompanies.length + pendingCategories.length;

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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border lg:hidden"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <p className="truncate font-heading text-xl leading-none font-bold tracking-[-0.01em] text-text">{title}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">
        <div className="hidden items-center gap-2.5 sm:flex">
          <Avatar name={adminName} photoUrl={adminPhotoUrl} size="sm" color="bg-secondary" />
          <p className="max-w-[160px] truncate text-[14px] font-semibold text-text">
            {greeting()}, {adminName}
          </p>
        </div>
        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((current) => !current)}
            aria-label={totalCount > 0 ? `${totalCount} verificação(ões) pendente(s)` : 'Verificações pendentes'}
            className={`relative flex h-10 w-10 items-center justify-center rounded-md border transition ${
              totalCount > 0 ? 'border-danger bg-danger/10 text-danger' : 'border-border text-text'
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
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                {totalCount > 9 ? '9+' : totalCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute top-12 right-0 z-50 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
              {totalCount === 0 ? (
                <p className="p-4 text-sm text-text-secondary">Nenhuma verificação pendente.</p>
              ) : (
                <ul>
                  {pendingWorkers.map((worker) => (
                    <li key={worker.workerId} className="border-b border-border last:border-b-0">
                      <Link
                        href="/admin/verificacoes"
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-3.5 text-sm text-text transition hover:bg-background"
                      >
                        <span className="font-semibold">{worker.workerFullName}</span> aguardando revisão de
                        documento.
                      </Link>
                    </li>
                  ))}
                  {pendingCompanies.map((company) => (
                    <li key={company.companyId} className="border-b border-border last:border-b-0">
                      <Link
                        href="/admin/verificacoes"
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-3.5 text-sm text-text transition hover:bg-background"
                      >
                        <span className="font-semibold">{company.tradeName}</span> aguardando verificação.
                      </Link>
                    </li>
                  ))}
                  {pendingCategories.map((category) => (
                    <li key={category.categoryId} className="border-b border-border last:border-b-0">
                      <Link
                        href="/admin/verificacoes"
                        onClick={() => setIsNotificationsOpen(false)}
                        className="block p-3.5 text-sm text-text transition hover:bg-background"
                      >
                        Categoria <span className="font-semibold">{category.name}</span> aguardando aprovação.
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="text-sm font-semibold text-text-secondary underline underline-offset-2 disabled:opacity-50"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
