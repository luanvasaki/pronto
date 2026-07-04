'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { CompanyProfileDetails, getCompanyProfile } from '../../lib/company-profile-api';

const VERIFICATION_STATUS_LABEL: Record<string, string> = {
  pending: 'Verificação em análise',
  approved: 'Empresa verificada',
  rejected: 'Verificação recusada',
};

const VERIFICATION_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

export default function PerfilPage() {
  const { isChecking } = useRequireAuth();
  const [profile, setProfile] = useState<CompanyProfileDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isChecking) return;

    getCompanyProfile()
      .then(setProfile)
      .catch(() => setError('Não foi possível carregar o perfil da empresa.'))
      .finally(() => setIsLoading(false));
  }, [isChecking]);

  if (isChecking || isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : 'Carregando o perfil da empresa...'}
        </p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">{error ?? 'Perfil não encontrado.'}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text">{profile.tradeName}</h1>
        <p className="mt-1 text-sm text-text-secondary">{profile.legalName}</p>
        <p className="mt-1 font-mono text-sm text-text-secondary">CNPJ {profile.cnpj}</p>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
            VERIFICATION_STATUS_CLASS[profile.verificationStatus] ?? VERIFICATION_STATUS_CLASS.pending
          }`}
        >
          {VERIFICATION_STATUS_LABEL[profile.verificationStatus] ?? profile.verificationStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-surface p-4 text-center">
          <p className="font-mono text-xl font-semibold text-text">{profile.avgRating ?? '—'}</p>
          <p className="mt-1 text-xs text-text-secondary">Nota média</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4 text-center">
          <p className="font-mono text-xl font-semibold text-text">{profile.totalJobsPosted}</p>
          <p className="mt-1 text-xs text-text-secondary">Vagas publicadas</p>
        </div>
      </div>
    </main>
  );
}
