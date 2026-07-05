'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { getCurrentPosition } from '../../lib/geolocation';
import { applyToJob, listNearbyJobs, NearbyJob } from '../../lib/jobs-api';
import { updateWorkerLocation } from '../../lib/worker-profile-api';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

/**
 * GET /jobs/nearby responde 400 quando o worker ainda não definiu
 * localização — nesse caso, pede a localização ao navegador, salva, e
 * tenta de novo uma vez. Qualquer outro erro sobe direto.
 */
async function fetchNearbyJobs(): Promise<{ jobs: NearbyJob[] }> {
  try {
    return await listNearbyJobs();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 400) {
      throw err;
    }
    const position = await getCurrentPosition('Precisamos da sua localização pra mostrar vagas perto de você.');
    await updateWorkerLocation(position.coords.latitude, position.coords.longitude);
    return listNearbyJobs();
  }
}

export default function InicioPage() {
  const [jobs, setJobs] = useState<NearbyJob[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<{ jobId: string; message: string } | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [jobsResult, categoriesResult] = await Promise.all([
          fetchNearbyJobs(),
          listSkillCategories(),
        ]);
        setJobs(jobsResult.jobs);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleApply(jobId: string): Promise<void> {
    setApplyError(null);
    setApplyingJobId(jobId);

    try {
      await applyToJob(jobId);
      setAppliedJobIds((current) => new Set(current).add(jobId));
    } catch (err) {
      setApplyError({
        jobId,
        message: err instanceof ApiError ? err.message : 'Não foi possível enviar sua candidatura.',
      });
    } finally {
      setApplyingJobId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Buscando vagas perto de você...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-text">Vagas perto de você</h1>
        <div className="flex gap-4">
          <Link
            href="/candidaturas"
            className="text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
          >
            Minhas candidaturas
          </Link>
          <Link
            href="/turnos"
            className="text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
          >
            Meus turnos
          </Link>
          <Link
            href="/perfil"
            className="text-sm text-text-secondary underline underline-offset-2 hover:text-primary"
          >
            Perfil
          </Link>
        </div>
      </div>

      {jobs.length === 0 && (
        <p className="text-sm text-text-secondary">Nenhuma vaga disponível perto de você no momento.</p>
      )}

      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-text">
                {categoryNames[job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
              </p>
              <span className="whitespace-nowrap text-xs font-medium text-text-secondary">
                {job.distanceKm} km
              </span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{job.description}</p>
            <p className="mt-1 text-sm text-text-secondary">{job.addressLabel}</p>
            <p className="mt-1 text-sm text-text-secondary">{formatDateRange(job.startsAt, job.endsAt)}</p>
            <p className="mt-2 font-mono text-sm font-semibold text-text">R$ {job.payAmount}</p>

            {applyError?.jobId === job.id && (
              <p className="mt-2 text-sm text-danger">{applyError.message}</p>
            )}

            <Button
              type="button"
              variant={appliedJobIds.has(job.id) ? 'outlined' : 'primary'}
              disabled={appliedJobIds.has(job.id)}
              isLoading={applyingJobId === job.id}
              onClick={() => handleApply(job.id)}
              className="mt-3 w-full"
            >
              {appliedJobIds.has(job.id) ? 'Candidatura enviada ✓' : 'Candidatar-se'}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
