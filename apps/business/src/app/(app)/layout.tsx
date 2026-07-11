'use client';

import { ApiError, getCurrentUser } from '@shift/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/ui/sidebar';
import { Topbar } from '../../components/ui/topbar';
import { useRequireAuth } from '../../hooks/use-require-auth';
import {
  CheckedInNotification,
  CompanyProfileDetails,
  getCompanyNotifications,
  getCompanyProfile,
  markShiftCheckInSeen,
  PendingApplicationNotification,
  PendingRatingNotification,
} from '../../lib/company-profile-api';
import { CompanyProfileProvider } from './company-profile-context';

// Sem WebSocket/push — reconsultar de tempos em tempos enquanto o
// painel fica aberto é o suficiente pro volume do MVP.
const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Não existe nome de responsável cadastrado (só razão social/nome
 * fantasia/CNPJ) — a saudação usa o nome fantasia da empresa em vez de
 * um nome de pessoa, já que não há esse dado hoje.
 */
function pageHeader(pathname: string, tradeName: string): { title: string; subtitle?: string } {
  if (pathname === '/painel') {
    return { title: `${greeting()}, ${tradeName}`, subtitle: 'Um resumo geral de como está sua operação' };
  }
  if (pathname === '/perfil') {
    return { title: 'Perfil da empresa' };
  }
  if (pathname === '/escala') {
    return { title: 'Calendário', subtitle: 'Clique num dia pra publicar uma escala' };
  }
  if (pathname === '/escalas') {
    return { title: 'Escalas', subtitle: 'Todas as suas escalas em aberto' };
  }
  if (pathname === '/vagas/nova') {
    return { title: 'Publicar escala' };
  }
  if (pathname.endsWith('/editar')) {
    return { title: 'Editar escala' };
  }
  if (pathname.startsWith('/vagas/')) {
    return { title: 'Candidatos' };
  }
  return { title: 'Pronto' };
}

/**
 * `useRequireAuth()` e `getCompanyProfile()` rodavam duplicados em
 * cada página (painel, perfil, vagas/*, admin) — centralizados aqui
 * uma vez só. Sidebar/Topbar vivem no shell; cada página só cuida do
 * próprio conteúdo.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<CompanyProfileDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [needsCadastro, setNeedsCadastro] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [pendingApplications, setPendingApplications] = useState<PendingApplicationNotification[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [checkedInNotifications, setCheckedInNotifications] = useState<CheckedInNotification[]>([]);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [pendingRatingsNotifications, setPendingRatingsNotifications] = useState<PendingRatingNotification[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isChecking) return;

    getCurrentUser()
      .then(({ user }) => setIsAdmin(user.isAdmin))
      .catch(() => undefined);
  }, [isChecking]);

  useEffect(() => {
    if (isChecking) return;

    getCompanyProfile()
      .then(setProfile)
      .catch((err) => {
        // Perfil ainda não existe (cadastro nunca completado — comum
        // logo após entrar pelo Google, que pula direto pro app) — leva
        // pra completar o cadastro em vez de travar com "sua empresa"
        // de placeholder pra sempre.
        if (err instanceof ApiError && err.status === 404) {
          setNeedsCadastro(true);
          router.replace('/cadastro');
        }
      })
      .finally(() => setIsLoadingProfile(false));
  }, [isChecking, router]);

  useEffect(() => {
    if (isChecking || needsCadastro) return;

    let cancelled = false;

    function poll(): void {
      getCompanyNotifications()
        .then((result) => {
          if (cancelled) return;
          setPendingApplicationsCount(result.pendingApplicationsCount);
          setPendingApplications(result.pendingApplications);
          setCheckedInCount(result.checkedInCount);
          setCheckedInNotifications(result.checkedInNotifications);
          setPendingRatingsCount(result.pendingRatingsCount);
          setPendingRatingsNotifications(result.pendingRatingsNotifications);
        })
        .catch(() => undefined);
    }

    poll();
    const intervalId = setInterval(poll, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isChecking, needsCadastro]);

  if (isChecking || isLoadingProfile || needsCadastro) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : needsCadastro ? 'Redirecionando...' : 'Carregando...'}
        </p>
      </main>
    );
  }

  const tradeName = profile?.tradeName ?? 'sua empresa';
  const { title, subtitle } = pageHeader(pathname, tradeName);

  // Marca como vista em segundo plano — o sino/lista continuam mostrando
  // o que já estava ali até o próximo poll (60s) confirmar que sumiu, pra
  // não sumir a lista debaixo do usuário logo depois de abrir o dropdown.
  function handleOpenNotifications(): void {
    checkedInNotifications.forEach((notification) => {
      markShiftCheckInSeen(notification.shiftId).catch(() => undefined);
    });
  }

  return (
    <CompanyProfileProvider initialProfile={profile}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          companyName={tradeName}
          logoUrl={profile?.logoUrl ?? null}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          isAdmin={isAdmin}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            title={title}
            subtitle={subtitle}
            onMenuClick={() => setIsMobileNavOpen(true)}
            pendingApplicationsCount={pendingApplicationsCount}
            pendingApplications={pendingApplications}
            checkedInCount={checkedInCount}
            checkedInNotifications={checkedInNotifications}
            pendingRatingsCount={pendingRatingsCount}
            pendingRatingsNotifications={pendingRatingsNotifications}
            onOpenNotifications={handleOpenNotifications}
          />
          <div className="flex-1 overflow-y-auto p-4 lg:p-7">{children}</div>
        </div>
      </div>
    </CompanyProfileProvider>
  );
}
