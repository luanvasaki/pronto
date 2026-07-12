'use client';

import { listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { StatCard } from '../../../components/ui/stat-card';
import { JobApplication } from '../../../lib/applications-api';
import { fetchApplicationsByJobId } from '../../../lib/job-applications-summary';
import { Job, listMyJobs } from '../../../lib/jobs-api';
import { useCompanyProfile } from '../company-profile-context';

const MAX_PENDING_RATINGS_SHOWN = 3;

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

interface PendingRatingRow {
  key: string;
  jobId: string;
  categoryName: string;
  workerName: string;
}

/**
 * Área gerencial — resumo de tudo, sem ação direta (aprovar candidato,
 * cancelar escala etc. mora em /escalas e /vagas/[id]). O que precisa
 * de decisão imediata da empresa fica em "Escalas", não aqui.
 */
export default function PainelPage() {
  const { profile } = useCompanyProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [applicationsByJobId, setApplicationsByJobId] = useState<Record<string, JobApplication[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [jobsResult, categoriesResult] = await Promise.all([listMyJobs(), listSkillCategories()]);
        setJobs(jobsResult.jobs);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));

        const relevantJobs = jobsResult.jobs.filter((job) => job.status !== 'cancelled');
        setApplicationsByJobId(await fetchApplicationsByJobId(relevantJobs));
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

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Sem status "encerrada" no banco (open/filled/cancelled só) — igual ao
  // feed do trabalhador, a escala some das listas ativas calculando pela
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
  const escalasPreenchidasNoMes = jobs.filter(
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

  // Escala concluída sem avaliação da empresa — fica em aberto até a
  // empresa avaliar (ver rateShift/RatingForm em vagas/[id]/page.tsx).
  // Não filtra por isPastEvent: o que importa aqui é o status do turno
  // (completed), não se a vaga em si já passou.
  const pendingRatingRows: PendingRatingRow[] = jobs.flatMap((job) =>
    (applicationsByJobId[job.id] ?? [])
      .filter((application) => application.shift?.status === 'completed' && !application.shift.ratings.company)
      .map((application) => ({
        key: application.id,
        jobId: job.id,
        categoryName: categoryNames[job.categoryId] ?? 'Categoria',
        workerName: application.worker.fullName,
      })),
  );

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-danger">{error}</p>}

      {jobs.length === 0 && !error && (
        <div className="rounded-[18px] border border-dashed border-border p-6 text-center">
          <p className="font-heading text-[17px] font-bold text-text">Você ainda não publicou nenhuma escala</p>
          <p className="mt-1.5 text-[13.5px] text-text-secondary">
            Publique sua primeira vaga pra começar a receber candidatos.
          </p>
          <Link
            href="/vagas/nova"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-90 active:brightness-75"
          >
            Publicar vaga
          </Link>
        </div>
      )}

      {pendingRatingRows.length > 0 && (
        <div className="rounded-[18px] border border-warning/30 bg-warning/10 p-4">
          <p className="font-heading text-[15px] font-bold text-warning">
            {pendingRatingRows.length === 1
              ? '1 escala concluída esperando sua avaliação'
              : `${pendingRatingRows.length} escalas concluídas esperando sua avaliação`}
          </p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {pendingRatingRows.slice(0, MAX_PENDING_RATINGS_SHOWN).map((row) => (
              <li key={row.key}>
                <Link href={`/vagas/${row.jobId}`} className="text-[13.5px] text-warning underline underline-offset-2">
                  Avalie {row.workerName} · {row.categoryName}
                </Link>
              </li>
            ))}
          </ul>
          {pendingRatingRows.length > MAX_PENDING_RATINGS_SHOWN && (
            <p className="mt-1.5 text-[12.5px] text-warning">
              +{pendingRatingRows.length - MAX_PENDING_RATINGS_SHOWN} escala(s)
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Escalas abertas"
          value={String(openJobs.length)}
          hint={`${pendingCandidates} candidato(s) aguardando`}
          hintClassName="text-primary font-semibold"
        />
        <StatCard
          label="Preenchidas na semana"
          value={String(filledThisWeek)}
          hint={openJobs.length === 0 ? '100% cobertas' : undefined}
          hintClassName="text-success font-semibold"
        />
        <StatCard
          label="Gasto no mês"
          value={`R$ ${formatMoney(gastoNoMes)}`}
          hint={`${escalasPreenchidasNoMes} escala(s) preenchida(s)`}
        />
        <StatCard label="Avaliação da casa" value={`★ ${profile?.avgRating ?? '—'}`} hint="como contratante" variant="dark" />
      </div>

      <div>
        <h2 className="font-heading text-[19px] font-bold text-text">Resumo do mês</h2>
        <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Escalas abertas no mês" value={String(profile?.jobsOpenedThisMonth ?? 0)} />
          <StatCard label="Pessoas contratadas" value={String(profile?.workersHiredThisMonth ?? 0)} />
          <StatCard
            label="Mais contratado(a)"
            value={profile?.topHiredWorkerName ?? '—'}
            hint={profile?.topHiredWorkerName ? `${profile.topHiredWorkerCount}x esse mês` : undefined}
          />
        </div>
      </div>

      {confirmedRows.length > 0 && (
        <div>
          <h2 className="font-heading text-[19px] font-bold text-text">Escalas confirmadas</h2>
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
