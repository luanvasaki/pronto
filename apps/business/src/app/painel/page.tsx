'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { getCompanyProfile } from '../../lib/company-profile-api';
import { cancelJob, Job, listMyJobs } from '../../lib/jobs-api';

const JOB_STATUS_LABEL: Record<string, string> = {
  open: 'Aberta',
  filled: 'Preenchida',
  cancelled: 'Cancelada',
};

const JOB_STATUS_CLASS: Record<string, string> = {
  open: 'bg-primary/10 text-primary',
  filled: 'bg-success/10 text-success',
  cancelled: 'bg-border text-text-secondary',
};

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface JobCardProps {
  job: Job;
  categoryName: string;
  isCanceling: boolean;
  cancelErrorMessage: string | undefined;
  onCancel: (jobId: string) => void;
}

function JobCard({ job, categoryName, isCanceling, cancelErrorMessage, onCancel }: JobCardProps) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-[17px] font-bold text-text">{categoryName}</p>
          <p className="mt-0.5 text-sm text-text-secondary">{job.addressLabel}</p>
          <p className="mt-0.5 text-sm text-text-secondary">{formatDateRange(job.startsAt, job.endsAt)}</p>
        </div>
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
            JOB_STATUS_CLASS[job.status] ?? JOB_STATUS_CLASS.open
          }`}
        >
          {JOB_STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        {job.positionsFilled}/{job.positionsTotal} preenchidas · R$ {job.payAmount} por pessoa
      </p>

      {cancelErrorMessage && <p className="mt-2 text-sm text-danger">{cancelErrorMessage}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/vagas/${job.id}`}
          className="inline-flex items-center justify-center rounded-[10px] border-[1.5px] border-secondary bg-secondary px-4 py-2 text-[13.5px] font-bold text-background"
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
            isLoading={isCanceling}
            onClick={() => onCancel(job.id)}
            className="px-3 py-1.5 text-xs"
          >
            Cancelar vaga
          </Button>
        )}
      </div>
    </li>
  );
}

export default function PainelPage() {
  const { isChecking } = useRequireAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyAvgRating, setCompanyAvgRating] = useState<string | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ jobId: string; message: string } | null>(null);

  useEffect(() => {
    if (isChecking) return;

    async function load(): Promise<void> {
      try {
        const [jobsResult, categoriesResult, companyProfile] = await Promise.all([
          listMyJobs(),
          listSkillCategories(),
          getCompanyProfile(),
        ]);
        setJobs(jobsResult.jobs);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
        setCompanyAvgRating(companyProfile.avgRating);
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

  const openJobs = jobs.filter((job) => job.status === 'open');
  const filledJobs = jobs.filter((job) => job.status === 'filled');
  const cancelledJobs = jobs.filter((job) => job.status === 'cancelled');
  const openPositions = openJobs.reduce((sum, job) => sum + (job.positionsTotal - job.positionsFilled), 0);
  const totalInvested = jobs.reduce((sum, job) => sum + Number(job.payAmount) * job.positionsFilled, 0);

  function renderCard(job: Job): React.ReactNode {
    return (
      <JobCard
        key={job.id}
        job={job}
        categoryName={categoryNames[job.categoryId] ?? 'Categoria'}
        isCanceling={cancelingJobId === job.id}
        cancelErrorMessage={cancelError?.jobId === job.id ? cancelError.message : undefined}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8">
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
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(245,83,30,0.28)] transition hover:brightness-90"
          >
            Publicar vaga
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[13px] text-text-secondary">Vagas abertas</p>
          <p className="mt-1 font-heading text-[28px] font-bold text-text">{openJobs.length}</p>
          <p className="mt-0.5 text-xs font-semibold text-primary">{openPositions} posição(ões) livre(s)</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[13px] text-text-secondary">Vagas preenchidas</p>
          <p className="mt-1 font-heading text-[28px] font-bold text-text">{filledJobs.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[13px] text-text-secondary">Total investido</p>
          <p className="mt-1 font-heading text-[28px] font-bold text-text">R$ {formatMoney(totalInvested)}</p>
        </div>
        <div className="rounded-2xl bg-secondary p-5 text-background">
          <p className="text-[13px] text-text-secondary">Avaliação da casa</p>
          <p className="mt-1 font-heading text-[28px] font-bold">★ {companyAvgRating ?? '—'}</p>
          <p className="mt-0.5 text-xs text-text-secondary">como contratante</p>
        </div>
      </div>

      {jobs.length === 0 && (
        <p className="text-sm text-text-secondary">Você ainda não publicou nenhuma vaga.</p>
      )}

      {openJobs.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold text-text">Precisam de gente</h2>
          <ul className="mt-3 flex flex-col gap-3">{openJobs.map(renderCard)}</ul>
        </div>
      )}

      {filledJobs.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold text-text">Vagas preenchidas</h2>
          <ul className="mt-3 flex flex-col gap-3">{filledJobs.map(renderCard)}</ul>
        </div>
      )}

      {cancelledJobs.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold text-text">Vagas canceladas</h2>
          <ul className="mt-3 flex flex-col gap-3">{cancelledJobs.map(renderCard)}</ul>
        </div>
      )}
    </main>
  );
}
