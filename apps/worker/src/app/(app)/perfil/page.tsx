'use client';

import { listSkillCategories, logout } from '@shift/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { getWorkerProfile, WorkerProfileDetails } from '../../../lib/worker-profile-api';

const KYC_STATUS_LABEL: Record<string, string> = {
  pending: 'Documento em análise',
  approved: 'Identidade verificada',
  rejected: 'Documento recusado',
};

const KYC_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfileDetails | null>(null);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push('/entrar');
    }
  }

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [profileResult, categoriesResult] = await Promise.all([
          getWorkerProfile(),
          listSkillCategories(),
        ]);
        setProfile(profileResult);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch {
        setError('Não foi possível carregar seu perfil.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando seu perfil...</p>
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
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex items-center gap-4">
        <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size="lg" color="bg-secondary" />
        <div>
          <h1 className="font-heading text-xl font-bold text-text">{profile.fullName}</h1>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
              KYC_STATUS_CLASS[profile.kycStatus] ?? KYC_STATUS_CLASS.pending
            }`}
          >
            {KYC_STATUS_LABEL[profile.kycStatus] ?? profile.kycStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-3.5 text-center">
          <p className="font-heading text-xl font-bold text-text">{profile.avgRating ?? '—'}</p>
          <p className="mt-1 text-xs text-text-secondary">Nota média</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3.5 text-center">
          <p className="font-heading text-xl font-bold text-text">{profile.totalShiftsCompleted}</p>
          <p className="mt-1 text-xs text-text-secondary">Turnos concluídos</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3.5 text-center">
          <p className="font-heading text-xl font-bold text-text">{profile.totalNoShows}</p>
          <p className="mt-1 text-xs text-text-secondary">Faltas</p>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-[17px] font-bold text-text">Minhas funções</h2>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {profile.categoryIds.map((categoryId) => (
            <span
              key={categoryId}
              className="rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text"
            >
              {categoryNames[categoryId] ?? 'Categoria'}
            </span>
          ))}
        </div>
      </div>

      <Link
        href="/candidaturas"
        className="text-center text-sm font-semibold text-primary underline underline-offset-2"
      >
        Minhas candidaturas
      </Link>

      <Button variant="outlined" onClick={handleLogout} isLoading={isLoggingOut}>
        Sair da conta
      </Button>
    </main>
  );
}
