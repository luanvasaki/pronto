'use client';

import { listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { listMyApplications, MyApplication } from '../../../lib/applications-api';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  withdrawn: 'Retirada',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  withdrawn: 'bg-border text-text-secondary',
};

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

export default function CandidaturasPage() {
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [applicationsResult, categoriesResult] = await Promise.all([
          listMyApplications(),
          listSkillCategories(),
        ]);
        setApplications(applicationsResult.applications);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch {
        setError('Não foi possível carregar suas candidaturas.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando suas candidaturas...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Minhas candidaturas</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {applications.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não se candidatou a nenhuma vaga.</p>
      )}

      <ul className="flex flex-col gap-3">
        {applications.map((application) => (
          <li
            key={application.id}
            className="rounded-[20px] border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading text-[17px] font-bold text-text">
                {categoryNames[application.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
              </p>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                  STATUS_CLASS[application.status] ?? STATUS_CLASS.pending
                }`}
              >
                {STATUS_LABEL[application.status] ?? application.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{application.job.addressLabel}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {formatDateRange(application.job.startsAt, application.job.endsAt)}
            </p>
            <p className="mt-2 font-heading text-lg font-bold text-primary">R$ {application.job.payAmount}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
