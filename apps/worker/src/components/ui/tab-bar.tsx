'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/inicio',
    label: 'Início',
    icon: (
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
    ),
  },
  {
    href: '/candidaturas',
    label: 'Candidaturas',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/turnos',
    label: 'Turnos',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  {
    href: '/perfil',
    label: 'Perfil',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex shrink-0 items-stretch border-t border-border bg-background/90 px-2 pt-2.5 pb-7 backdrop-blur-md">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 ${active ? 'text-primary' : 'text-text-secondary'}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {tab.icon}
            </svg>
            <span className="text-[11px] font-semibold">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
