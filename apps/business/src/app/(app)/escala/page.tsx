'use client';

import { listSkillCategories, SkillCategory } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { JobApplication } from '../../../lib/applications-api';
import { fetchApplicationsByJobId } from '../../../lib/job-applications-summary';
import { Job, listMyJobs } from '../../../lib/jobs-api';

const WEEKDAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const JOB_STATUS_DOT: Record<string, string> = {
  open: 'bg-warning',
  filled: 'bg-success',
  cancelled: 'bg-border',
};

const MAX_JOBS_PER_DAY = 3;
const MAX_WORKER_NAMES_PER_DAY = 2;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCalendarGrid(monthDate: Date): Date {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function EscalaPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
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
        setCategoryNames(
          Object.fromEntries(categoriesResult.categories.map((category: SkillCategory) => [category.id, category.name])),
        );

        // Quem trabalhou (ou vai trabalhar) em cada dia — só pra vagas
        // que já tiveram alguma aprovação, pra não pedir candidatos de
        // toda vaga aberta sem necessidade.
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
        <p className="text-sm text-text-secondary">Carregando sua escala...</p>
      </main>
    );
  }

  const jobsByDateKey = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = toDateKey(new Date(job.startsAt));
    const dayJobs = jobsByDateKey.get(key) ?? [];
    dayJobs.push(job);
    jobsByDateKey.set(key, dayJobs);
  }

  const workerNamesByDateKey = new Map<string, string[]>();
  for (const job of jobs) {
    const approvedNames = (applicationsByJobId[job.id] ?? [])
      .filter((application) => application.status === 'approved')
      .map((application) => application.worker.fullName);
    if (approvedNames.length === 0) continue;

    const key = toDateKey(new Date(job.startsAt));
    const names = workerNamesByDateKey.get(key) ?? [];
    workerNamesByDateKey.set(key, [...names, ...approvedNames]);
  }

  const gridStart = startOfCalendarGrid(currentMonth);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const today = new Date();

  return (
    <main className="flex flex-1 flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[19px] font-bold text-text">{monthLabel(currentMonth)}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-text transition hover:border-primary hover:text-primary"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="rounded-[10px] border border-border px-3 py-1.5 text-[13px] font-semibold text-text transition hover:border-primary hover:text-primary"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-text transition hover:border-primary hover:text-primary"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase">
        {WEEKDAY_LABEL.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 gap-2">
        {days.map((date) => {
          const dateKey = toDateKey(date);
          const dayJobs = jobsByDateKey.get(dateKey) ?? [];
          const inCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const isToday = isSameDate(date, today);

          return (
            <div
              key={dateKey}
              className={`flex min-h-[104px] flex-col gap-1.5 rounded-[14px] border p-2 ${
                inCurrentMonth ? 'border-border bg-surface' : 'border-transparent bg-background/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[13px] font-semibold ${
                    isToday
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white'
                      : inCurrentMonth
                        ? 'text-text'
                        : 'text-text-secondary/50'
                  }`}
                >
                  {date.getDate()}
                </span>
                <Link
                  href={`/vagas/nova?data=${dateKey}`}
                  aria-label={`Publicar escala em ${dateKey}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                >
                  +
                </Link>
              </div>

              <div className="flex flex-col gap-1">
                {dayJobs.slice(0, MAX_JOBS_PER_DAY).map((job) => (
                  <Link
                    key={job.id}
                    href={`/vagas/${job.id}`}
                    className="flex items-center gap-1.5 rounded-md bg-background px-1.5 py-1 text-[11px] font-semibold text-text transition hover:bg-primary/10"
                  >
                    <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${JOB_STATUS_DOT[job.status] ?? 'bg-border'}`} />
                    <span className="truncate">{categoryNames[job.categoryId] ?? 'Categoria'}</span>
                  </Link>
                ))}
                {dayJobs.length > MAX_JOBS_PER_DAY && (
                  <span className="px-1.5 text-[11px] text-text-secondary">+{dayJobs.length - MAX_JOBS_PER_DAY}</span>
                )}
              </div>

              {(() => {
                const workerNames = workerNamesByDateKey.get(dateKey) ?? [];
                if (workerNames.length === 0) return null;
                const shown = workerNames.slice(0, MAX_WORKER_NAMES_PER_DAY);
                const extra = workerNames.length - shown.length;
                return (
                  <p className="mt-auto truncate text-[10.5px] text-text-secondary" title={workerNames.join(', ')}>
                    👤 {shown.join(', ')}
                    {extra > 0 ? ` +${extra}` : ''}
                  </p>
                );
              })()}
            </div>
          );
        })}
      </div>
    </main>
  );
}
