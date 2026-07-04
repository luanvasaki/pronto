'use client';

import { listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { getWorkerProfile, WorkerProfileDetails } from '../../lib/worker-profile-api';

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
  const [profile, setProfile] = useState<WorkerProfileDetails | null>(null);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text">{profile.fullName}</h1>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
            KYC_STATUS_CLASS[profile.kycStatus] ?? KYC_STATUS_CLASS.pending
          }`}
        >
          {KYC_STATUS_LABEL[profile.kycStatus] ?? profile.kycStatus}
        </span>
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-secondary">Categorias</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.categoryIds.map((categoryId) => (
            <span
              key={categoryId}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text"
            >
              {categoryNames[categoryId] ?? 'Categoria'}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-surface p-4 text-center">
          <p className="font-mono text-xl font-semibold text-text">{profile.avgRating ?? '—'}</p>
          <p className="mt-1 text-xs text-text-secondary">Nota média</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4 text-center">
          <p className="font-mono text-xl font-semibold text-text">{profile.totalShiftsCompleted}</p>
          <p className="mt-1 text-xs text-text-secondary">Turnos concluídos</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4 text-center">
          <p className="font-mono text-xl font-semibold text-text">{profile.totalNoShows}</p>
          <p className="mt-1 text-xs text-text-secondary">Faltas</p>
        </div>
      </div>
    </main>
  );
}
