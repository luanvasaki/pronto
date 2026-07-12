'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { JobApplication } from '../../../lib/applications-api';
import { fetchApplicationsByJobId } from '../../../lib/job-applications-summary';
import { cancelJob, Job, listMyJobs } from '../../../lib/jobs-api';

const DAY_LABEL = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

type TimeFilter = 'futuras' | 'passadas' | 'todas';

function formatTimeRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

/**
 * "Passada" é sobre o horário de início já ter chegado, não sobre o
 * status — uma vaga `open` que já começou provavelmente não vai mais
 * receber candidatos, mas ninguém marcou ela como preenchida/cancelada
 * ainda. Isso é só pra organizar a lista, não muda o status de verdade.
 */
function isPast(job: Job): boolean {
  return new Date(job.startsAt).getTime() < Date.now();
}

/**
 * Diferente do "Precisam de gente" do Início (que só mostra escalas
 * ainda por vir, pra focar em ação imediata), aqui é a lista completa
 * de escalas abertas — inclusive as que já passaram do horário de
 * início mas ainda não foram marcadas como preenchidas/canceladas.
 */
export default function EscalasPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [applicationsByJobId, setApplicationsByJobId] = useState<Record<string, JobApplication[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancelJobId, setConfirmingCancelJobId] = useState<string | null>(null);
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ jobId: string; message: string } | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('futuras');

  async function handleCancel(jobId: string): Promise<void> {
    setCancelError(null);
    setCancelingJobId(jobId);

    try {
      const updated = await cancelJob(jobId);
      setJobs((current) => current.map((job) => (job.id === jobId ? updated : job)));
      setConfirmingCancelJobId(null);
    } catch (err) {
      setCancelError({
        jobId,
        message: err instanceof ApiError ? err.message : 'Não foi possível cancelar a escala.',
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

        const openJobs = jobsResult.jobs.filter((job) => job.status === 'open');
        setApplicationsByJobId(await fetchApplicationsByJobId(openJobs));
      } catch {
        setError('Não foi possível carregar suas escalas.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando suas escalas...</p>
      </main>
    );
  }

  const openJobs = jobs.filter((job) => job.status === 'open');
  const futureJobs = openJobs.filter((job) => !isPast(job));
  const pastJobs = openJobs.filter((job) => isPast(job));
  const visibleJobs = timeFilter === 'futuras' ? futureJobs : timeFilter === 'passadas' ? pastJobs : openJobs;

  return (
    <main className="flex flex-1 flex-col gap-3.5">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        {(
          [
            ['futuras', `Futuras (${futureJobs.length})`],
            ['passadas', `Passadas (${pastJobs.length})`],
            ['todas', `Todas (${openJobs.length})`],
          ] as [TimeFilter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTimeFilter(value)}
            className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold transition ${
              timeFilter === value
                ? 'border-primary bg-primary text-white'
                : 'border-border text-text-secondary hover:border-primary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-secondary">
          {timeFilter === 'passadas'
            ? 'Nenhuma escala passada em aberto.'
            : 'Nenhuma escala em aberto agora. Publique uma quando precisar de gente.'}
        </div>
      ) : (
        visibleJobs.map((job) => {
          const start = new Date(job.startsAt);
          const past = isPast(job);
          const pendingCount = (applicationsByJobId[job.id] ?? []).filter((a) => a.status === 'pending').length;
          return (
            <div
              key={job.id}
              className={`rounded-2xl border p-5 ${
                past ? 'border-border bg-background/60 opacity-70' : 'border-border bg-surface'
              }`}
            >
              <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-5">
                <div
                  className={`flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[13px] ${
                    past ? 'bg-border/60 text-text-secondary' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <span className="font-heading text-lg leading-none font-extrabold">{start.getDate()}</span>
                  <span className="text-[10px] font-semibold tracking-[0.06em] uppercase">
                    {DAY_LABEL[start.getDay()]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-[17px] font-bold text-text">
                    {categoryNames[job.categoryId] ?? 'Categoria'} · {job.positionsTotal - job.positionsFilled}{' '}
                    vaga(s)
                    {past && (
                      <span className="ml-2 rounded-full bg-border/60 px-2 py-0.5 text-[11px] font-semibold text-text-secondary uppercase">
                        Encerrada
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13.5px] text-text-secondary">
                    {formatTimeRange(job.startsAt, job.endsAt)} · R$ {job.payAmount} por pessoa
                  </p>
                  {(job.offersMeal || job.offersTransport) && (
                    <p className="mt-1 text-[12px] text-text-secondary">
                      {[job.offersMeal && 'Alimentação', job.offersTransport && 'Transporte']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex w-full shrink-0 items-center justify-between gap-3.5 sm:w-auto sm:justify-start">
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

              {cancelError?.jobId === job.id && <p className="mt-2.5 text-sm text-danger">{cancelError.message}</p>}

              <div className="mt-3.5 border-t border-border pt-3.5">
                {confirmingCancelJobId === job.id ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-danger/40 p-3">
                    <p className="text-sm text-text">
                      Tem certeza? Candidaturas pendentes são rejeitadas e quem já estava aprovado perde a escala.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        isLoading={cancelingJobId === job.id}
                        onClick={() => handleCancel(job.id)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Sim, cancelar
                      </Button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancelJobId(null)}
                        className="text-sm text-text-secondary underline underline-offset-2"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/vagas/${job.id}/editar`}
                      className="text-sm text-primary underline underline-offset-2 hover:brightness-90"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/vagas/nova?template=${job.id}`}
                      className="text-sm text-primary underline underline-offset-2 hover:brightness-90"
                    >
                      Duplicar
                    </Link>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => setConfirmingCancelJobId(job.id)}
                      className="px-3 py-1.5 text-xs"
                    >
                      Cancelar escala
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </main>
  );
}
