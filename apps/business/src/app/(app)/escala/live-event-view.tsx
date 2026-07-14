'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getLiveEventStatus, LiveEventJob, LiveShiftStatus } from '../../../lib/live-event-api';

const POLL_INTERVAL_MS = 30_000;

const STATUS_STYLES: Record<LiveShiftStatus, { label: string; className: string }> = {
  atrasado: { label: 'Atrasado', className: 'bg-danger/10 text-danger' },
  aguardando: { label: 'Aguardando', className: 'bg-background text-text-secondary' },
  chegou: { label: 'Chegou', className: 'bg-success/10 text-success' },
  concluido: { label: 'Concluído', className: 'bg-background text-text-secondary' },
};

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dayLabel(date: Date): string {
  const today = startOfDay(new Date());
  if (date.getTime() === today.getTime()) return 'Hoje';
  if (date.getTime() === addDays(today, 1).getTime()) return 'Amanhã';
  if (date.getTime() === addDays(today, -1).getTime()) return 'Ontem';
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/**
 * Status de cada turno é recalculado a cada carga (nunca fica "preso" num
 * valor salvo) — por isso o polling: um trabalhador que passa de
 * "aguardando" pra "atrasado" só porque o relógio andou precisa aparecer
 * sem o dono precisar apertar F5.
 */
export function LiveEventView() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [jobs, setJobs] = useState<LiveEventJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(isFirstLoadForThisDay: boolean): Promise<void> {
      if (isFirstLoadForThisDay) setIsLoading(true);
      try {
        const dayEnd = addDays(selectedDate, 1);
        const result = await getLiveEventStatus(selectedDate, dayEnd);
        if (cancelled) return;
        setJobs(result.jobs);
        setError(null);
      } catch {
        if (!cancelled) setError('Não foi possível carregar a operação ao vivo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load(true);
    const intervalId = setInterval(() => void load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedDate]);

  const totalShifts = jobs.reduce((sum, job) => sum + job.shifts.length, 0);
  const lateCount = jobs.reduce((sum, job) => sum + job.shifts.filter((shift) => shift.status === 'atrasado').length, 0);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-[17px] font-bold text-text">{dayLabel(selectedDate)}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Dia anterior"
            onClick={() => setSelectedDate((date) => addDays(date, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-text transition hover:border-primary hover:text-primary"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(startOfDay(new Date()))}
            className="rounded-[10px] border border-border px-3 py-1.5 text-[13px] font-semibold text-text transition hover:border-primary hover:text-primary"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Próximo dia"
            onClick={() => setSelectedDate((date) => addDays(date, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-text transition hover:border-primary hover:text-primary"
          >
            ›
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Carregando operação ao vivo...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-border p-6 text-center">
          <p className="text-[13.5px] text-text-secondary">Nenhuma escala nesse dia.</p>
        </div>
      ) : (
        <>
          {lateCount > 0 && (
            <p className="rounded-[12px] border border-danger/30 bg-danger/10 px-4 py-2.5 text-[13.5px] font-semibold text-danger">
              {lateCount === 1 ? '1 pessoa atrasada' : `${lateCount} pessoas atrasadas`} de {totalShifts} escalada(s)
              hoje.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div key={job.jobId} className="rounded-[14px] border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/vagas/${job.jobId}`} className="font-heading text-[15px] font-bold text-text hover:text-primary">
                      {job.categoryName}
                    </Link>
                    <p className="text-[12.5px] text-text-secondary">
                      {formatTime(job.startsAt)}–{formatTime(job.endsAt)} · {job.addressLabel}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold text-text-secondary">
                    {job.positionsFilled}/{job.positionsTotal} posições
                  </span>
                </div>

                {job.shifts.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                    {job.shifts.map((shift) => (
                      <div key={shift.shiftId} className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-medium text-text">{shift.workerName}</span>
                        <div className="flex items-center gap-2">
                          {shift.status === 'atrasado' && shift.minutesLate !== null && (
                            <span className="text-[12px] text-danger">{shift.minutesLate} min</span>
                          )}
                          {shift.status === 'chegou' && shift.checkInAt && (
                            <span className="text-[12px] text-text-secondary">{formatTime(shift.checkInAt)}</span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[shift.status].className}`}
                          >
                            {STATUS_STYLES[shift.status].label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
