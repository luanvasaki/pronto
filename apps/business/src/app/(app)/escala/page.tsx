'use client';

import { listSkillCategories, SkillCategory } from '@shift/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { JobApplication } from '../../../lib/applications-api';
import { startOfWeek } from '../../../lib/date-utils';
import { fetchApplicationsByJobId } from '../../../lib/job-applications-summary';
import { duplicateWeek, Job, listMyJobs } from '../../../lib/jobs-api';

const WEEKDAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** Semana começa na segunda pra bater com "Preenchidas na semana" do painel — visão de operação, não de calendário. */
const WEEKDAY_LABEL_WEEK = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

const JOB_STATUS_DOT: Record<string, string> = {
  open: 'bg-warning',
  filled: 'bg-success',
  cancelled: 'bg-border',
};

type DayStatus = 'vazio' | 'parcial' | 'preenchido';

const DAY_STATUS_STYLES: Record<DayStatus, { label: string; className: string }> = {
  vazio: { label: 'Sem escala', className: 'text-text-secondary' },
  parcial: { label: 'Parcial', className: 'bg-warning/15 text-warning' },
  preenchido: { label: 'Preenchido', className: 'bg-success/15 text-success' },
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

function weekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startFormatter = new Intl.DateTimeFormat('pt-BR', sameMonth ? { day: '2-digit' } : { day: '2-digit', month: 'short' });
  const endFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${startFormatter.format(weekStart)}–${endFormatter.format(weekEnd)}`;
}

function dayStatus(dayJobs: Job[]): DayStatus {
  const activeJobs = dayJobs.filter((job) => job.status !== 'cancelled');
  if (activeJobs.length === 0) return 'vazio';
  return activeJobs.every((job) => job.positionsFilled >= job.positionsTotal) ? 'preenchido' : 'parcial';
}

interface WeekWorkerChip {
  key: string;
  name: string;
  previousShiftsWithCompany: number;
}

export default function EscalaPage() {
  const [viewMode, setViewMode] = useState<'mes' | 'semana'>('mes');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [applicationsByJobId, setApplicationsByJobId] = useState<Record<string, JobApplication[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDuplicatePanelOpen, setIsDuplicatePanelOpen] = useState(false);
  const [duplicateTermsAccepted, setDuplicateTermsAccepted] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicateSuccessCount, setDuplicateSuccessCount] = useState<number | null>(null);

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
  const workerChipsByDateKey = new Map<string, WeekWorkerChip[]>();
  for (const job of jobs) {
    const approvedApplications = (applicationsByJobId[job.id] ?? []).filter((application) => application.status === 'approved');
    if (approvedApplications.length === 0) continue;

    const key = toDateKey(new Date(job.startsAt));
    const names = workerNamesByDateKey.get(key) ?? [];
    workerNamesByDateKey.set(
      key,
      [...names, ...approvedApplications.map((application) => application.worker.fullName)],
    );

    const chips = workerChipsByDateKey.get(key) ?? [];
    workerChipsByDateKey.set(key, [
      ...chips,
      ...approvedApplications.map((application) => ({
        key: application.id,
        name: application.worker.fullName,
        previousShiftsWithCompany: application.worker.previousShiftsWithCompany,
      })),
    ]);
  }

  const today = new Date();

  async function handleConfirmDuplicate(): Promise<void> {
    setIsDuplicating(true);
    setDuplicateError(null);
    try {
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(targetWeekStart.getDate() + 7);
      const result = await duplicateWeek(
        { sourceWeekStart: currentWeekStart.toISOString(), targetWeekStart: targetWeekStart.toISOString() },
        duplicateTermsAccepted,
      );
      // As vagas novas já vêm completas na resposta — mescla localmente em
      // vez de recarregar o histórico inteiro da empresa (listMyJobs não
      // filtra por data) só pra ver 1 semana nova. Nenhuma tem candidato
      // ainda, então applicationsByJobId não precisa de entrada pra elas.
      setJobs((previousJobs) => [...previousJobs, ...result.jobs]);
      setDuplicateSuccessCount(result.jobs.length);
      setIsDuplicatePanelOpen(false);
      setDuplicateTermsAccepted(false);
      setCurrentWeekStart(targetWeekStart);
    } catch (duplicateException) {
      setDuplicateError(
        duplicateException instanceof Error ? duplicateException.message : 'Não foi possível duplicar a semana.',
      );
    } finally {
      setIsDuplicating(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[19px] font-bold text-text">
            {viewMode === 'mes' ? monthLabel(currentMonth) : weekRangeLabel(currentWeekStart)}
          </h1>
          <div className="flex rounded-[10px] border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('mes')}
              className={`rounded-[8px] px-3 py-1 text-[12.5px] font-semibold transition ${
                viewMode === 'mes' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setViewMode('semana')}
              className={`rounded-[8px] px-3 py-1 text-[12.5px] font-semibold transition ${
                viewMode === 'semana' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
              }`}
            >
              Semana
            </button>
          </div>
        </div>

        {viewMode === 'mes' ? (
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
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDuplicateSuccessCount(null);
                if (isDuplicatePanelOpen) {
                  setDuplicateTermsAccepted(false);
                }
                setIsDuplicatePanelOpen((open) => !open);
              }}
              className="rounded-[10px] border border-primary px-3 py-1.5 text-[13px] font-semibold text-primary transition hover:bg-primary/10"
            >
              Duplicar semana
            </button>
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => setCurrentWeekStart((start) => new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7))}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-text transition hover:border-primary hover:text-primary"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCurrentWeekStart(startOfWeek(new Date()))}
              className="rounded-[10px] border border-border px-3 py-1.5 text-[13px] font-semibold text-text transition hover:border-primary hover:text-primary"
            >
              Hoje
            </button>
            <button
              type="button"
              aria-label="Próxima semana"
              onClick={() => setCurrentWeekStart((start) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7))}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-text transition hover:border-primary hover:text-primary"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {viewMode === 'semana' && duplicateSuccessCount !== null && (
        <p className="rounded-[12px] border border-success/30 bg-success/10 px-4 py-2.5 text-[13.5px] font-semibold text-success">
          {duplicateSuccessCount === 1
            ? '1 escala duplicada pra semana seguinte.'
            : `${duplicateSuccessCount} escalas duplicadas pra semana seguinte.`}
        </p>
      )}

      {viewMode === 'semana' &&
        isDuplicatePanelOpen &&
        (() => {
          const targetWeekStart = new Date(currentWeekStart);
          targetWeekStart.setDate(targetWeekStart.getDate() + 7);
          const weekJobsCount = Array.from({ length: 7 })
            .map((_, index) => {
              const date = new Date(currentWeekStart);
              date.setDate(date.getDate() + index);
              return (jobsByDateKey.get(toDateKey(date)) ?? []).filter((job) => job.status !== 'cancelled').length;
            })
            .reduce((sum, count) => sum + count, 0);

          if (weekJobsCount === 0) {
            return (
              <div className="rounded-[14px] border border-border bg-surface p-4 text-[13.5px] text-text-secondary">
                Não há escalas nessa semana pra duplicar.
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-3 rounded-[14px] border border-primary/30 bg-primary/5 p-4">
              <p className="text-[13.5px] font-semibold text-text">
                Duplicar {weekJobsCount} escala(s) de {weekRangeLabel(currentWeekStart)} pra{' '}
                {weekRangeLabel(targetWeekStart)}, no mesmo dia da semana e horário — sem candidatos, sem vagas
                preenchidas, tudo do zero.
              </p>
              <label className="flex items-start gap-2 text-[12.5px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={duplicateTermsAccepted}
                  onChange={(event) => setDuplicateTermsAccepted(event.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que essas escalas são intermediação avulsa, sem vínculo empregatício.
              </label>
              {duplicateError && <p className="text-[12.5px] text-danger">{duplicateError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!duplicateTermsAccepted || isDuplicating}
                  onClick={() => void handleConfirmDuplicate()}
                  className="rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDuplicating ? 'Duplicando...' : 'Confirmar duplicação'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDuplicatePanelOpen(false);
                    setDuplicateError(null);
                    setDuplicateTermsAccepted(false);
                  }}
                  className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-text-secondary transition hover:text-text"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        })()}

      {viewMode === 'mes' ? (
        <>
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase">
            {WEEKDAY_LABEL.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-7 gap-2">
            {Array.from({ length: 42 }, (_, index) => {
              const date = new Date(startOfCalendarGrid(currentMonth));
              date.setDate(date.getDate() + index);
              return date;
            }).map((date) => {
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
        </>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, index) => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + index);
            return date;
          }).map((date, index) => {
            const dateKey = toDateKey(date);
            const dayJobs = jobsByDateKey.get(dateKey) ?? [];
            const activeDayJobs = dayJobs.filter((job) => job.status !== 'cancelled');
            const status = dayStatus(dayJobs);
            const isToday = isSameDate(date, today);
            const chips = workerChipsByDateKey.get(dateKey) ?? [];

            return (
              <div
                key={dateKey}
                className="flex min-h-[180px] flex-col gap-2 rounded-[14px] border border-border bg-surface p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase">
                      {WEEKDAY_LABEL_WEEK[index]}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white' : 'text-text'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  <Link
                    href={`/vagas/nova?data=${dateKey}`}
                    aria-label={`Publicar escala em ${dateKey}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                  >
                    +
                  </Link>
                </div>

                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${DAY_STATUS_STYLES[status].className}`}
                >
                  {DAY_STATUS_STYLES[status].label}
                </span>

                <div className="flex flex-col gap-1.5">
                  {activeDayJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/vagas/${job.id}`}
                      className="rounded-md bg-background px-2 py-1.5 text-[11.5px] font-semibold text-text transition hover:bg-primary/10"
                    >
                      <span className="truncate">{categoryNames[job.categoryId] ?? 'Categoria'}</span>
                      <span className="ml-1 font-normal text-text-secondary">
                        {job.positionsFilled}/{job.positionsTotal}
                      </span>
                    </Link>
                  ))}
                </div>

                {chips.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1">
                    {chips.map((chip) => (
                      <span
                        key={chip.key}
                        className="rounded-full bg-background px-2 py-0.5 text-[10.5px] font-medium text-text-secondary"
                        title={
                          chip.previousShiftsWithCompany > 0
                            ? `${chip.name} já trabalhou ${chip.previousShiftsWithCompany}x com você`
                            : chip.name
                        }
                      >
                        {chip.name}
                        {chip.previousShiftsWithCompany > 0 && (
                          <span className="ml-1 text-primary">· {chip.previousShiftsWithCompany}x aqui</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
