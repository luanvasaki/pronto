'use client';

import { ApiError } from '@shift/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoginTermsModal } from '../../components/ui/login-terms-modal';
import { Sidebar } from '../../components/ui/sidebar';
import { Topbar } from '../../components/ui/topbar';
import { VerificationBanner } from '../../components/ui/verification-banner';
import { useRequireAuth } from '../../hooks/use-require-auth';
import {
  CheckedInNotification,
  CheckedOutNotification,
  CompanyProfileDetails,
  getCompanyNotifications,
  getCompanyProfile,
  PendingApplicationNotification,
  PendingRatingNotification,
} from '../../lib/company-profile-api';
import { CompanyProfileProvider } from './company-profile-context';

// Sem WebSocket/push — reconsultar de tempos em tempos enquanto o
// painel fica aberto é o suficiente pro volume do MVP.
const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

/**
 * A saudação ("Boa noite, {empresa}") mora no Topbar agora, fixa no
 * canto superior direito ao lado do sino — não é mais o título da
 * página, então /painel usa um título neutro como as outras rotas.
 */
function pageHeader(pathname: string): { title: string; subtitle?: string } {
  if (pathname === '/painel') {
    return { title: 'Início', subtitle: 'Um resumo geral de como está sua operação' };
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
  if (pathname === '/trabalhadores') {
    return { title: 'Trabalhadores', subtitle: 'Todo mundo com quem você já trabalhou' };
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
 * cada página (painel, perfil, vagas/*) — centralizados aqui uma vez
 * só. Sidebar/Topbar vivem no shell; cada página só cuida do próprio
 * conteúdo.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<CompanyProfileDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [needsCadastro, setNeedsCadastro] = useState(false);
  const [needsTerms, setNeedsTerms] = useState(false);
  const [showLoginTermsModal, setShowLoginTermsModal] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);
  const [pendingApplications, setPendingApplications] = useState<PendingApplicationNotification[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [checkedInNotifications, setCheckedInNotifications] = useState<CheckedInNotification[]>([]);
  const [checkedOutCount, setCheckedOutCount] = useState(0);
  const [checkedOutNotifications, setCheckedOutNotifications] = useState<CheckedOutNotification[]>([]);
  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);
  const [pendingRatingsNotifications, setPendingRatingsNotifications] = useState<PendingRatingNotification[]>([]);

  useEffect(() => {
    if (isChecking) return;

    getCompanyProfile()
      .then((data) => {
        if (data.needsTermsAcceptance) {
          setNeedsTerms(true);
          router.replace('/cadastro/termos');
          return;
        }
        setProfile(data);
        setShowLoginTermsModal(!data.hasAcceptedLoginTerms);
      })
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
    if (isChecking || needsCadastro || needsTerms) return;

    let cancelled = false;

    function poll(): void {
      getCompanyNotifications()
        .then((result) => {
          if (cancelled) return;
          setPendingApplicationsCount(result.pendingApplicationsCount);
          setPendingApplications(result.pendingApplications);
          setCheckedInCount(result.checkedInCount);
          setCheckedInNotifications(result.checkedInNotifications);
          setCheckedOutCount(result.checkedOutCount);
          setCheckedOutNotifications(result.checkedOutNotifications);
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
  }, [isChecking, needsCadastro, needsTerms]);

  if (isChecking || isLoadingProfile || needsCadastro || needsTerms) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : needsCadastro || needsTerms ? 'Redirecionando...' : 'Carregando...'}
        </p>
      </main>
    );
  }

  const tradeName = profile?.tradeName ?? 'sua empresa';
  const { title, subtitle } = pageHeader(pathname);

  return (
    <CompanyProfileProvider initialProfile={profile}>
      {showLoginTermsModal && <LoginTermsModal onAccepted={() => setShowLoginTermsModal(false)} />}
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          companyName={tradeName}
          logoUrl={profile?.logoUrl ?? null}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            title={title}
            subtitle={subtitle}
            companyName={tradeName}
            logoUrl={profile?.logoUrl ?? null}
            onMenuClick={() => setIsMobileNavOpen(true)}
            pendingApplicationsCount={pendingApplicationsCount}
            pendingApplications={pendingApplications}
            checkedInCount={checkedInCount}
            checkedInNotifications={checkedInNotifications}
            checkedOutCount={checkedOutCount}
            checkedOutNotifications={checkedOutNotifications}
            pendingRatingsCount={pendingRatingsCount}
            pendingRatingsNotifications={pendingRatingsNotifications}
          />
          {profile && (
            <VerificationBanner verificationStatus={profile.verificationStatus} rejectionReason={profile.rejectionReason} />
          )}
          <div className="flex-1 overflow-y-auto p-4 lg:p-7">{children}</div>
        </div>
      </div>
    </CompanyProfileProvider>
  );
}
