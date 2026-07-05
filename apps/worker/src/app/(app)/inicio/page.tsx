'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { getCurrentPosition } from '../../../lib/geolocation';
import { applyToJob, listNearbyJobs, NearbyJob } from '../../../lib/jobs-api';
import { updateWorkerLocation } from '../../../lib/worker-profile-api';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatHours(startsAt: string, endsAt: string): string {
  const hours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (60 * 60 * 1000);
  return `${Math.round(hours)}h`;
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
    <main className="flex flex-1 flex-col gap-1 px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-heading text-[19px] font-bold text-text">Turnos perto de você</h1>
        <span className="text-[13px] font-semibold text-primary">{jobs.length} disponíveis</span>
      </div>

      {jobs.length === 0 && (
        <p className="mt-3 text-sm text-text-secondary">Nenhuma vaga disponível perto de você no momento.</p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {jobs.map((job) => {
          const applied = appliedJobIds.has(job.id);
          return (
            <li
              key={job.id}
              className="rounded-[20px] border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-[19px] leading-[1.05] font-bold text-text">
                    {categoryNames[job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                  </p>
                  <p className="mt-1 text-[13.5px] text-text-secondary">
                    {job.companyName}
                    {job.companyAvgRating && ` · ★ ${job.companyAvgRating}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-heading text-[19px] font-bold text-primary">R$ {job.payAmount}</p>
                  <p className="text-xs text-text-secondary">{formatHours(job.startsAt, job.endsAt)}</p>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {formatDateRange(job.startsAt, job.endsAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {job.distanceKm} km
                </span>
              </div>

              <p className="mt-2 text-[13.5px] text-text-secondary">{job.addressLabel}</p>

              {applyError?.jobId === job.id && (
                <p className="mt-2 text-sm text-danger">{applyError.message}</p>
              )}

              <Button
                type="button"
                variant={applied ? 'outlined' : 'primary'}
                disabled={applied}
                isLoading={applyingJobId === job.id}
                onClick={() => handleApply(job.id)}
                className="mt-3.5 w-full"
              >
                {applied ? 'Candidatura enviada ✓' : 'Aceitar turno'}
              </Button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
