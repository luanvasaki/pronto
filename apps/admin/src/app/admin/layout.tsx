'use client';

import { getCurrentUser, logout } from '@shift/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminNav } from '../../components/ui/admin-nav';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { listPendingVerifications } from '../../lib/admin-api';

// Sem WebSocket/push — reconsultar de tempos em tempos enquanto o
// painel fica aberto é o suficiente pro volume do MVP (mesmo padrão
// do sino de notificações do app de empresa).
const PENDING_VERIFICATIONS_POLL_INTERVAL_MS = 60_000;

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
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState(0);

  useEffect(() => {
    if (isChecking) return;

    getCurrentUser()
      .then(({ user }) => setIsAdmin(user.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setIsLoadingUser(false));
  }, [isChecking]);

  useEffect(() => {
    if (isChecking || isLoadingUser || !isAdmin) return;

    let cancelled = false;

    function poll(): void {
      listPendingVerifications()
        .then((result) => {
          if (cancelled) return;
          // Documento de identidade + selfie do mesmo trabalhador contam
          // como 1 pendência só, não 2 — o que importa é quantos
          // trabalhadores esperam revisão, não quantos arquivos.
          const pendingWorkerCount = new Set(result.documents.map((document) => document.workerId)).size;
          setPendingVerificationsCount(pendingWorkerCount + result.companies.length + result.skillCategories.length);
        })
        .catch(() => undefined);
    }

    poll();
    const intervalId = setInterval(poll, PENDING_VERIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isChecking, isLoadingUser, isAdmin]);

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
      <AdminNav
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        pendingVerificationsCount={pendingVerificationsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsNavOpen(true)}
              aria-label="Abrir menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border lg:hidden"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <p className="truncate font-heading text-xl leading-none font-bold tracking-[-0.01em] text-text">
              {pageTitle(pathname)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            <Link
              href="/admin/verificacoes"
              aria-label={
                pendingVerificationsCount > 0
                  ? `${pendingVerificationsCount} verificação(ões) pendente(s)`
                  : 'Verificações pendentes'
              }
              className={`relative flex h-10 w-10 items-center justify-center rounded-md border transition ${
                pendingVerificationsCount > 0 ? 'border-danger bg-danger/10 text-danger' : 'border-border text-text'
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
              {pendingVerificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
                  {pendingVerificationsCount > 9 ? '9+' : pendingVerificationsCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-sm font-semibold text-text-secondary underline underline-offset-2 disabled:opacity-50"
            >
              Sair
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-7">{children}</div>
      </div>
    </div>
  );
}
