'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/ui/sidebar';
import { Topbar } from '../../components/ui/topbar';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { CompanyProfileDetails, getCompanyProfile } from '../../lib/company-profile-api';
import { CompanyProfileProvider } from './company-profile-context';

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
    return { title: `${greeting()}, ${tradeName}`, subtitle: 'Aqui está o que precisa da sua atenção hoje' };
  }
  if (pathname === '/perfil') {
    return { title: 'Perfil da empresa' };
  }
  if (pathname === '/admin') {
    return { title: 'Painel administrativo' };
  }
  if (pathname === '/vagas/nova') {
    return { title: 'Publicar turno' };
  }
  if (pathname.endsWith('/editar')) {
    return { title: 'Editar turno' };
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
  const pathname = usePathname();
  const [profile, setProfile] = useState<CompanyProfileDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (isChecking) return;

    getCompanyProfile()
      .then(setProfile)
      .catch(() => undefined)
      .finally(() => setIsLoadingProfile(false));
  }, [isChecking]);

  if (isChecking || isLoadingProfile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : 'Carregando...'}
        </p>
      </main>
    );
  }

  const tradeName = profile?.tradeName ?? 'sua empresa';
  const { title, subtitle } = pageHeader(pathname, tradeName);

  return (
    <CompanyProfileProvider initialProfile={profile}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar companyName={tradeName} logoUrl={profile?.logoUrl ?? null} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} subtitle={subtitle} />
          <div className="flex-1 overflow-y-auto p-7">{children}</div>
        </div>
      </div>
    </CompanyProfileProvider>
  );
}
