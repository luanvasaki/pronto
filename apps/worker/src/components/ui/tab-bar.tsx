'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/inicio',
    label: 'Escalas',
    icon: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />,
  },
  {
    href: '/agenda',
    label: 'Agenda',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  {
    href: '/ganhos',
    label: 'Ganhos',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
        <circle cx="15.5" cy="14" r="1.4" fill="currentColor" />
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

/**
 * Pílula flutuante (estilo Instagram) em vez da barra antiga presa e
 * full-width — mesmos 4 destinos e ícones de sempre, só o contêiner
 * muda. `bg-secondary`/`text-background` é o mesmo par "superfície
 * invertida" já usado no Sidebar/AdminNav — pílula sempre contrasta
 * com o fundo da página nos dois temas, sem precisar de uma cor fixa
 * (que ficaria errada no escuro). `fixed` tira a barra do fluxo, por
 * isso o layout (`(app)/layout.tsx`) reserva um respiro embaixo do
 * conteúdo pra ela nunca cobrir o final da tela.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-7 z-20 flex justify-center px-4"
    >
      <div className="flex items-center gap-1 rounded-full bg-secondary p-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                active ? 'bg-background/15 text-background' : 'text-background/55 hover:text-background/80'
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                {tab.icon}
              </svg>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
