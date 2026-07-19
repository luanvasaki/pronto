'use client';

import { getCurrentUser, logout, UserResponse } from '@shift/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminNav } from '../../components/ui/admin-nav';
import { Topbar } from '../../components/ui/topbar';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { listPendingVerifications, PendingVerifications } from '../../lib/admin-api';

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

/** Admin não tem nome de exibição próprio (só email) — usa a parte antes do "@", mesmo espírito do resto do app. */
function displayName(email: string): string {
  return email.split('@')[0] ?? email;
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
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerifications | null>(null);

  useEffect(() => {
    if (isChecking) return;

    getCurrentUser()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => setCurrentUser(null))
      .finally(() => setIsLoadingUser(false));
  }, [isChecking]);

  const isAdmin = currentUser?.isAdmin ?? false;

  useEffect(() => {
    if (isChecking || isLoadingUser || !isAdmin) return;

    let cancelled = false;

    function poll(): void {
      listPendingVerifications()
        .then((result) => {
          if (!cancelled) setPendingVerifications(result);
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

  // Documento de identidade + selfie do mesmo trabalhador contam como 1
  // pendência só, não 2 — o que importa é quantos trabalhadores esperam
  // revisão, não quantos arquivos.
  const pendingWorkers = Array.from(
    new Map(
      (pendingVerifications?.documents ?? []).map((document) => [
        document.workerId,
        { workerId: document.workerId, workerFullName: document.workerFullName },
      ]),
    ).values(),
  );
  const pendingCompanies = (pendingVerifications?.companies ?? []).map((company) => ({
    companyId: company.id,
    tradeName: company.tradeName,
  }));
  const pendingCategories = (pendingVerifications?.skillCategories ?? []).map((category) => ({
    categoryId: category.id,
    name: category.name,
  }));
  const pendingVerificationsCount = pendingWorkers.length + pendingCompanies.length + pendingCategories.length;

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminNav
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        pendingVerificationsCount={pendingVerificationsCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={pageTitle(pathname)}
          adminName={currentUser ? displayName(currentUser.email) : 'admin'}
          adminPhotoUrl={currentUser?.googlePhotoUrl}
          onMenuClick={() => setIsNavOpen(true)}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          pendingWorkers={pendingWorkers}
          pendingCompanies={pendingCompanies}
          pendingCategories={pendingCategories}
        />
        <div className="flex-1 overflow-y-auto p-4 lg:p-7">{children}</div>
      </div>
    </div>
  );
}
