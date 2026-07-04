'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { cancelJob, Job, listMyJobs } from '../../lib/jobs-api';

const JOB_STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  filled: 'Preenchida',
  cancelled: 'Cancelada',
};

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

export default function PainelPage() {
  const { isChecking } = useRequireAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ jobId: string; message: string } | null>(null);

  useEffect(() => {
    if (isChecking) return;

    async function load(): Promise<void> {
      try {
        const [jobsResult, categoriesResult] = await Promise.all([listMyJobs(), listSkillCategories()]);
        setJobs(jobsResult.jobs);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch {
        setError('Não foi possível carregar suas vagas.');
      } finally {
        setIsLoadingJobs(false);
      }
    }

    void load();
  }, [isChecking]);

  async function handleCancel(jobId: string): Promise<void> {
    setCancelError(null);
    setCancelingJobId(jobId);

    try {
      const updated = await cancelJob(jobId);
      setJobs((current) => current.map((job) => (job.id === jobId ? updated : job)));
    } catch (err) {
      setCancelError({
        jobId,
        message: err instanceof ApiError ? err.message : 'Não foi possível cancelar a vaga.',
      });
    } finally {
      setCancelingJobId(null);
    }
  }

  if (isChecking || isLoadingJobs) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : 'Carregando suas vagas...'}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-text">Suas vagas</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/perfil"
            className="text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
          >
            Perfil
          </Link>
          <Link
            href="/vagas/nova"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-90"
          >
            Publicar vaga
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {jobs.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não publicou nenhuma vaga.</p>
      )}

      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">
                  {categoryNames[job.categoryId] ?? 'Categoria'}
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">{job.addressLabel}</p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {formatDateRange(job.startsAt, job.endsAt)}
                </p>
              </div>
              <span className="whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {JOB_STATUS_LABEL[job.status] ?? job.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              {job.positionsFilled}/{job.positionsTotal} preenchidas · R$ {job.payAmount}
            </p>

            {cancelError?.jobId === job.id && (
              <p className="mt-2 text-sm text-danger">{cancelError.message}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href={`/vagas/${job.id}`}
                className="text-sm text-primary underline underline-offset-2 hover:brightness-90"
              >
                Ver candidatos
              </Link>
              {job.status === 'open' && (
                <Link
                  href={`/vagas/${job.id}/editar`}
                  className="text-sm text-primary underline underline-offset-2 hover:brightness-90"
                >
                  Editar
                </Link>
              )}
              {job.status !== 'cancelled' && (
                <Button
                  type="button"
                  variant="outlined"
                  isLoading={cancelingJobId === job.id}
                  onClick={() => handleCancel(job.id)}
                  className="px-3 py-1.5 text-xs"
                >
                  Cancelar vaga
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
