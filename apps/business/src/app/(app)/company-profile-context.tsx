'use client';

import { createContext, useContext, useState } from 'react';
import { CompanyProfileDetails } from '../../lib/company-profile-api';

export interface CompanyProfileContextValue {
  profile: CompanyProfileDetails | null;
  setProfile: (profile: CompanyProfileDetails) => void;
}

const CompanyProfileContext = createContext<CompanyProfileContextValue | null>(null);

/**
 * Perfil da empresa buscado uma vez no layout (sidebar + topbar
 * precisam do nome/logo) — páginas que hoje chamam getCompanyProfile()
 * sozinhas (painel, perfil) passam a ler daqui em vez de refazer a
 * mesma chamada.
 */
export function CompanyProfileProvider({
  initialProfile,
  children,
}: {
  initialProfile: CompanyProfileDetails | null;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<CompanyProfileDetails | null>(initialProfile);

  return (
    <CompanyProfileContext.Provider value={{ profile, setProfile }}>{children}</CompanyProfileContext.Provider>
  );
}

export function useCompanyProfile(): CompanyProfileContextValue {
  const context = useContext(CompanyProfileContext);
  if (!context) {
    throw new Error('useCompanyProfile precisa estar dentro de CompanyProfileProvider.');
  }
  return context;
}
