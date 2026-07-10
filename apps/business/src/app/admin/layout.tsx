'use client';

import { getCurrentUser, logout } from '@shift/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminNav } from '../../components/ui/admin-nav';
import { useRequireAuth } from '../../hooks/use-require-auth';

function pageTitle(pathname: string): string {
  if (pathname === '/admin') return 'Visão geral';
  if (pathname === '/admin/verificacoes') return 'Verificações pendentes';
  if (pathname === '/admin/empresas') return 'Empresas';
  if (pathname === '/admin/trabalhadores') return 'Trabalhadores';
  return 'Administração';
}

/**
 * Layout próprio pro painel admin, fora do grupo `(app)` de propósito —
 * aquele layout exige perfil de empresa (redireciona pra /cadastro se não
 * existir), o que impedia um admin sem empresa própria de acessar /admin.
 * Aqui só checa sessão + `isAdmin`, sem tocar em company-profile.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isChecking) return;

    getCurrentUser()
      .then(({ user }) => setIsAdmin(user.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setIsLoadingUser(false));
  }, [isChecking]);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push('/entrar');
    }
  }

  if (isChecking || isLoadingUser) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Confirmando sua sessão...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">Essa área é restrita a administradores.</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminNav isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNavOpen(true)}
              aria-label="Abrir menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-border lg:hidden"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <p className="truncate font-heading text-xl leading-none font-bold tracking-[-0.01em] text-text">
              {pageTitle(pathname)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="shrink-0 text-sm font-semibold text-text-secondary underline underline-offset-2 disabled:opacity-50"
          >
            Sair
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-7">{children}</div>
      </div>
    </div>
  );
}
