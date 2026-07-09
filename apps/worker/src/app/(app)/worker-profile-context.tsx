'use client';

import { createContext, useContext, useState } from 'react';
import { WorkerProfileDetails } from '../../lib/worker-profile-api';

export interface WorkerProfileContextValue {
  profile: WorkerProfileDetails | null;
  setProfile: (profile: WorkerProfileDetails) => void;
}

const WorkerProfileContext = createContext<WorkerProfileContextValue | null>(null);

/**
 * Perfil do trabalhador buscado uma vez no layout — páginas que hoje
 * chamavam getWorkerProfile() sozinhas (início, perfil) passam a ler
 * daqui em vez de refazer a mesma chamada. Espelha o
 * CompanyProfileProvider do app business.
 */
export function WorkerProfileProvider({
  initialProfile,
  children,
}: {
  initialProfile: WorkerProfileDetails | null;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<WorkerProfileDetails | null>(initialProfile);

  return (
    <WorkerProfileContext.Provider value={{ profile, setProfile }}>{children}</WorkerProfileContext.Provider>
  );
}

export function useWorkerProfile(): WorkerProfileContextValue {
  const context = useContext(WorkerProfileContext);
  if (!context) {
    throw new Error('useWorkerProfile precisa estar dentro de WorkerProfileProvider.');
  }
  return context;
}
