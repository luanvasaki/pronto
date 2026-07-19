'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { MapLink } from '../../../components/ui/map-link';
import { CardListSkeleton } from '../../../components/ui/skeleton';
import { listMyApplications, MyApplication, withdrawApplication } from '../../../lib/applications-api';

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

/**
 * `status === 'rejected'` cobre dois casos bem diferentes pro
 * trabalhador: nunca ter sido aceito, ou ter sido aceito e depois
 * removido da escala pela empresa (bem mais grave). `removedAt` (já
 * vem do backend) diferencia os dois — mesmo padrão visual que a tela
 * de Início já usa pro alerta de remoção.
 */
function statusLabel(application: MyApplication): string {
  if (application.removedAt !== null) return 'Removida';
  return STATUS_LABEL[application.status] ?? application.status;
}

function statusClass(application: MyApplication): string {
  if (application.removedAt !== null) return 'bg-danger/10 text-danger';
  return STATUS_CLASS[application.status] ?? STATUS_CLASS.pending;
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

export default function CandidaturasPage() {
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingWithdrawId, setConfirmingWithdrawId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  async function handleWithdraw(applicationId: string): Promise<void> {
    if (confirmingWithdrawId !== applicationId) {
      setConfirmingWithdrawId(applicationId);
      return;
    }

    setWithdrawError(null);
    setWithdrawingId(applicationId);
    try {
      await withdrawApplication(applicationId);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId ? { ...application, status: 'withdrawn' } : application,
        ),
      );
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : 'Não foi possível cancelar a candidatura.');
    } finally {
      setWithdrawingId(null);
      setConfirmingWithdrawId(null);
    }
  }

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
      <main className="flex flex-1 flex-col gap-4 px-5 py-8">
        <CardListSkeleton />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Minhas candidaturas</h1>

      {error && <p className="text-sm text-danger">{error}</p>}
      {withdrawError && <p className="text-sm text-danger">{withdrawError}</p>}

      {applications.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não se candidatou a nenhuma vaga.</p>
      )}

      <ul className="flex flex-col gap-3">
        {applications.map((application) => (
          <li
            key={application.id}
            className="rounded-lg border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-[16px] font-bold text-text">
                  {categoryNames[application.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                </p>
                <p className="text-[14px] font-semibold text-text-secondary">{application.companyName}</p>
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(application)}`}
              >
                {statusLabel(application)}
              </span>
            </div>
            <MapLink
              addressLabel={application.job.addressLabel}
              lat={application.job.locationLat}
              lng={application.job.locationLng}
              className="mt-1 text-sm"
            />
            <p className="mt-1 text-sm text-text-secondary">
              {formatDateRange(application.job.startsAt, application.job.endsAt)}
            </p>
            <p className="mt-2 font-heading text-lg font-bold text-primary">R$ {application.job.payAmount}</p>

            <Link
              href={`/vaga/${application.job.id}`}
              className="mt-2.5 inline-block text-sm font-semibold text-primary underline underline-offset-2"
            >
              Ver detalhes, avisos e perguntas
            </Link>

            {application.status === 'pending' && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant={confirmingWithdrawId === application.id ? 'danger' : 'outlined'}
                  isLoading={withdrawingId === application.id}
                  onClick={() => handleWithdraw(application.id)}
                >
                  {confirmingWithdrawId === application.id ? 'Confirmar cancelamento' : 'Cancelar candidatura'}
                </Button>
                {confirmingWithdrawId === application.id && withdrawingId !== application.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmingWithdrawId(null)}
                    className="text-sm text-text-secondary underline underline-offset-2"
                  >
                    Voltar
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
