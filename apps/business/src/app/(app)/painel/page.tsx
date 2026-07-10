'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { StatCard } from '../../../components/ui/stat-card';
import { JobApplication, listJobApplications } from '../../../lib/applications-api';
import { cancelJob, Job, listMyJobs } from '../../../lib/jobs-api';
import { useCompanyProfile } from '../company-profile-context';

const DAY_LABEL = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

function startOfWeek(reference: Date): Date {
  const date = new Date(reference);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // segunda como início da semana
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameMonth(date: Date, reference: Date): boolean {
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

interface ConfirmedRow {
  key: string;
  categoryName: string;
  dayTime: string;
  workerName: string;
  workerPhotoUrl: string | null;
}

export default function PainelPage() {
  const { profile } = useCompanyProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [applicationsByJobId, setApplicationsByJobId] = useState<Record<string, JobApplication[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ jobId: string; message: string } | null>(null);

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

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [jobsResult, categoriesResult] = await Promise.all([listMyJobs(), listSkillCategories()]);
        setJobs(jobsResult.jobs);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));

        const relevantJobs = jobsResult.jobs.filter((job) => job.status !== 'cancelled');
        const applicationsResults = await Promise.all(
          relevantJobs.map((job) => listJobApplications(job.id).then((result) => [job.id, result.applications] as const)),
        );
        setApplicationsByJobId(Object.fromEntries(applicationsResults));
      } catch {
        setError('Não foi possível carregar suas vagas.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando suas vagas...</p>
      </main>
    );
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Sem status "encerrada" no banco (open/filled/cancelled só) — igual ao
  // feed do trabalhador, o turno some das listas ativas calculando pela
  // data em vez de guardar mais um estado.
  const isPastEvent = (job: Job) => new Date(job.endsAt).getTime() < now.getTime();

  const openJobs = jobs.filter((job) => job.status === 'open' && !isPastEvent(job));
  const pendingCandidates = openJobs.reduce(
    (sum, job) => sum + (applicationsByJobId[job.id] ?? []).filter((a) => a.status === 'pending').length,
    0,
  );

  const filledThisWeek = jobs.filter(
    (job) => job.status === 'filled' && new Date(job.startsAt) >= weekStart && new Date(job.startsAt) < weekEnd,
  ).length;

  const gastoNoMes = jobs
    .filter((job) => isSameMonth(new Date(job.startsAt), now))
    .reduce((sum, job) => sum + Number(job.payAmount) * job.positionsFilled, 0);
  const turnosPreenchidosNoMes = jobs.filter(
    (job) => isSameMonth(new Date(job.startsAt), now) && job.positionsFilled > 0,
  ).length;

  const confirmedRows: ConfirmedRow[] = jobs
    .filter((job) => job.status !== 'cancelled' && !isPastEvent(job))
    .flatMap((job) =>
      (applicationsByJobId[job.id] ?? [])
        .filter((application) => application.status === 'approved')
        .map((application) => ({
          key: application.id,
          categoryName: categoryNames[job.categoryId] ?? 'Categoria',
          dayTime: `${DAY_LABEL[new Date(job.startsAt).getDay()]} · ${formatTimeRange(job.startsAt, job.endsAt)}`,
          workerName: application.worker.fullName,
          workerPhotoUrl: application.worker.photoUrl,
        })),
    );

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Turnos abertos"
          value={String(openJobs.length)}
          hint={`${pendingCandidates} candidato(s) aguardando`}
          hintClassName="text-primary font-semibold"
        />
        <StatCard
          label="Preenchidos na semana"
          value={String(filledThisWeek)}
          hint={openJobs.length === 0 ? '100% cobertos' : undefined}
          hintClassName="text-success font-semibold"
        />
        <StatCard
          label="Gasto no mês"
          value={`R$ ${formatMoney(gastoNoMes)}`}
          hint={`${turnosPreenchidosNoMes} turno(s) preenchidos`}
        />
        <StatCard label="Avaliação da casa" value={`★ ${profile?.avgRating ?? '—'}`} hint="como contratante" variant="dark" />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-[19px] font-bold text-text">Precisam de gente</h2>
          <span className="text-sm text-text-secondary">Escolha e aprove em segundos</span>
        </div>

        {openJobs.length === 0 ? (
          <div className="mt-3.5 rounded-2xl border border-dashed border-border p-8 text-center text-text-secondary">
            Tudo coberto por aqui. Publique um novo turno quando precisar.
          </div>
        ) : (
          <div className="mt-3.5 flex flex-col gap-3">
            {openJobs.map((job) => {
              const start = new Date(job.startsAt);
              const pendingCount = (applicationsByJobId[job.id] ?? []).filter((a) => a.status === 'pending').length;
              return (
                <div key={job.id} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center gap-5">
                    <div className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[13px] bg-primary/10 text-primary">
                      <span className="font-heading text-lg leading-none font-extrabold">{start.getDate()}</span>
                      <span className="text-[10px] font-semibold tracking-[0.06em] uppercase">
                        {DAY_LABEL[start.getDay()]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-[17px] font-bold text-text">
                        {categoryNames[job.categoryId] ?? 'Categoria'} ·{' '}
                        {job.positionsTotal - job.positionsFilled} vaga(s)
                      </p>
                      <p className="mt-0.5 text-[13.5px] text-text-secondary">
                        {formatTimeRange(job.startsAt, job.endsAt)} · R$ {job.payAmount} por pessoa
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3.5">
                      <span className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[13px] font-semibold text-text">
                        <span className="h-[7px] w-[7px] rounded-full bg-success" />
                        {pendingCount} candidatos
                      </span>
                      <Link
                        href={`/vagas/${job.id}`}
                        className="rounded-[10px] border-[1.5px] border-secondary bg-secondary px-4 py-2 text-[13.5px] font-bold text-background"
                      >
                        Ver candidatos
                      </Link>
                    </div>
                  </div>

                  {cancelError?.jobId === job.id && (
                    <p className="mt-2.5 text-sm text-danger">{cancelError.message}</p>
                  )}

                  <div className="mt-3.5 flex items-center gap-3 border-t border-border pt-3.5">
                    <Link
                      href={`/vagas/${job.id}/editar`}
                      className="text-sm text-primary underline underline-offset-2 hover:brightness-90"
                    >
                      Editar
                    </Link>
                    <Button
                      type="button"
                      variant="outlined"
                      isLoading={cancelingJobId === job.id}
                      onClick={() => handleCancel(job.id)}
                      className="px-3 py-1.5 text-xs"
                    >
                      Cancelar vaga
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmedRows.length > 0 && (
        <div>
          <h2 className="font-heading text-[19px] font-bold text-text">Turnos confirmados</h2>
          <div className="mt-3.5 flex flex-col gap-2.5">
            {confirmedRows.map((row) => (
              <div
                key={row.key}
                className="flex items-center gap-4 rounded-[14px] border border-border bg-surface px-5 py-3.5"
              >
                <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-success" />
                <div className="flex-1 text-[15px]">
                  <span className="font-semibold text-text">{row.categoryName}</span>
                  <span className="text-text-secondary"> · {row.dayTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={row.workerName} photoUrl={row.workerPhotoUrl} size="sm" />
                  <span className="text-sm font-semibold text-text">{row.workerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
