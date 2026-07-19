'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { CardListSkeleton } from '../../../components/ui/skeleton';
import { getCompanyWorkerHistory, WorkerHistoryEntry } from '../../../lib/workers-api';

const ATTENDANCE_STYLES = {
  good: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  bad: 'bg-danger/10 text-danger',
  neutral: 'bg-background text-text-secondary',
} as const;

function attendanceStyle(rate: number | null): keyof typeof ATTENDANCE_STYLES {
  if (rate === null) return 'neutral';
  if (rate >= 90) return 'good';
  if (rate >= 70) return 'warn';
  return 'bad';
}

function formatLastWorked(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const now = new Date();
  const daysAgo = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (daysAgo <= 0) return 'Hoje';
  if (daysAgo === 1) return 'Ontem';
  if (daysAgo < 30) return `Há ${daysAgo} dias`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

/**
 * A fatia local do grafo de confiança: todo trabalhador com quem essa
 * empresa já teve pelo menos um turno resolvido, ranqueado por
 * comparecimento — a memória que hoje só existe na cabeça do dono.
 */
export default function TrabalhadoresPage() {
  const [workers, setWorkers] = useState<WorkerHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const result = await getCompanyWorkerHistory();
        setWorkers(result.workers);
      } catch {
        setError('Não foi possível carregar seu histórico de trabalhadores.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-5">
        <CardListSkeleton />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div>
        <h1 className="font-heading text-[19px] font-bold text-text">Trabalhadores</h1>
        <p className="mt-1 text-[14px] text-text-secondary">
          Todo mundo com quem você já trabalhou, ordenado por quem você pode chamar com mais confiança.
        </p>
      </div>

      {workers.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-heading text-[16px] font-bold text-text">Ainda sem histórico</p>
          <p className="mt-1.5 text-[14px] text-text-secondary">
            Assim que um turno for concluído (ou faltado), o trabalhador aparece aqui.
          </p>
        </div>
      )}

      {workers.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {workers.map((worker) => (
            <div
              key={worker.workerId}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-5 py-3.5"
            >
              <div className="flex min-w-[180px] flex-1 items-center gap-3">
                <Avatar name={worker.fullName} photoUrl={worker.photoUrl} size="sm" />
                <span className="text-[16px] font-semibold text-text">{worker.fullName}</span>
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] text-text-secondary">Turnos</span>
                <span className="text-[14px] font-semibold text-text">
                  {worker.shiftsCompleted} concluído(s)
                  {worker.noShowCount > 0 && <span className="text-danger"> · {worker.noShowCount} falta(s)</span>}
                </span>
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] text-text-secondary">Comparecimento</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[14px] font-semibold ${ATTENDANCE_STYLES[attendanceStyle(worker.attendanceRate)]}`}
                >
                  {worker.attendanceRate === null ? '—' : `${worker.attendanceRate}%`}
                </span>
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] text-text-secondary">Sua nota</span>
                <span className="text-[14px] font-semibold text-text">
                  {worker.avgRatingGiven ? `★ ${worker.avgRatingGiven}` : '—'}
                </span>
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] text-text-secondary">Última vez</span>
                <span className="text-[14px] font-semibold text-text">{formatLastWorked(worker.lastWorkedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
