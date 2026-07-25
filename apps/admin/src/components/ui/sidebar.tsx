'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from './logo';

interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    label: 'Visão geral',
    icon: (
      <path
        d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: '/admin/verificacoes',
    label: 'Verificações',
    icon: (
      <>
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  {
    href: '/admin/empresas',
    label: 'Empresas',
    icon: (
      <>
        <rect x="4" y="10" width="7" height="10" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="4" width="7" height="16" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  {
    href: '/admin/trabalhadores',
    label: 'Trabalhadores',
    icon: (
      <>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 4.5a3 3 0 010 6M21 20c0-2.8-1.8-4.6-4-5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
];

export interface AdminNavProps {
  isOpen: boolean;
  onClose: () => void;
  pendingVerificationsCount?: number;
}

/**
 * Menu lateral do site pronto-admin (app dedicado — ver
 * app/admin/layout.tsx). Sem "voltar pra empresa": esse site é só
 * admin, não tem painel de empresa pra voltar.
 *
 * Badge em "Verificações" repete o mesmo número do sino no topo — dois
 * lugares pro mesmo aviso, de propósito: o sino chama atenção assim que
 * a tela abre, o badge continua visível enquanto o admin navega por
 * outras telas do painel.
 */
export function AdminNav({ isOpen, onClose, pendingVerificationsCount = 0 }: AdminNavProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[236px] shrink-0 flex-col bg-secondary p-4 text-background transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-end gap-1.5 px-2 pt-1 pb-6">
          <Logo variant="inverted" />
          <span className="font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] text-background">
            Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const showBadge = item.href === '/admin/verificacoes' && pendingVerificationsCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-semibold transition ${
                  active ? 'bg-background/10 text-background' : 'text-background/70 hover:bg-background/5'
                }`}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  {item.icon}
                </svg>
                {item.label}
                {showBadge && (
                  <span className="ml-auto flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                    {pendingVerificationsCount > 9 ? '9+' : pendingVerificationsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
