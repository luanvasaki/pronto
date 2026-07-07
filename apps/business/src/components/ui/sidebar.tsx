'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from './avatar';
import { Logo } from './logo';

interface NavItem {
  href: string;
  label: string;
  available: boolean;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/painel',
    label: 'Início',
    available: true,
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
    href: '/turnos',
    label: 'Turnos',
    available: false,
    icon: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M8 6V4h8v2M3 11h18" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  {
    href: '/escala',
    label: 'Escala',
    available: false,
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M3 9h18M8 3v4M16 3v4M7 14h3M13 14h4M7 17h3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    href: '/profissionais',
    label: 'Profissionais',
    available: false,
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
        <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 5.5a3 3 0 010 5.5M18 20c0-2.4-1-4.2-2.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
];

export interface SidebarProps {
  companyName: string;
  logoUrl: string | null;
}

/**
 * Turnos/Escala/Profissionais ainda não têm página própria (ver
 * README do handoff) — ficam visíveis no menu pra bater com o
 * mockup, mas desabilitados ("em breve") até existirem de verdade.
 */
export function Sidebar({ companyName, logoUrl }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[236px] shrink-0 flex-col bg-secondary p-4 text-background">
      <div className="flex items-end gap-2 px-2 pt-1 pb-6">
        <Logo />
        <span className="mb-0.5 text-[10px] font-semibold tracking-[0.14em] text-background/50 uppercase">
          Empresa
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;

          if (!item.available) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[14.5px] font-semibold text-background/30"
                title="Em breve"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  {item.icon}
                </svg>
                {item.label}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[14.5px] font-semibold transition ${
                active ? 'bg-background/10 text-background' : 'text-background/70 hover:bg-background/5'
              }`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/perfil"
        className="mt-auto flex items-center gap-2.5 rounded-xl bg-background/5 p-3 transition hover:bg-background/10"
      >
        <Avatar name={companyName} photoUrl={logoUrl} size="sm" shape="square" color="bg-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-background">{companyName}</p>
          <p className="text-xs text-background/50">Ver perfil</p>
        </div>
      </Link>
    </aside>
  );
}
