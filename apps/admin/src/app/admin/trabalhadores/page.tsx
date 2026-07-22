'use client';

import { ApiError, formatPhone } from '@shift/shared';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { ConsentHistory } from '../../../components/ui/consent-history';
import { Input } from '../../../components/ui/input';
import { CardListSkeleton } from '../../../components/ui/skeleton';
import { AdminWorker, listAdminWorkers, resetUserPassword } from '../../../lib/admin-api';

const KYC_LABEL: Record<string, string> = {
  pending: 'Documento em análise',
  approved: 'Identidade verificada',
  rejected: 'Documento recusado',
};

const KYC_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

type SortOrder = 'shiftsCompleted' | 'hoursWorked' | 'recent';

export default function AdminTrabalhadoresPage() {
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('shiftsCompleted');

  const [confirmingResetId, setConfirmingResetId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetMessages, setResetMessages] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    listAdminWorkers()
      .then((result) => setWorkers(result.workers))
      .catch(() => setError('Não foi possível carregar os trabalhadores.'))
      .finally(() => setIsLoading(false));
  }, []);

  const visibleWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? workers.filter((worker) => worker.fullName.toLowerCase().includes(term)) : workers;

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOrder === 'hoursWorked') {
        return b.hoursWorked - a.hoursWorked;
      }
      return b.shiftsCompleted - a.shiftsCompleted;
    });
  }, [workers, search, sortOrder]);

  async function handleResetPassword(worker: AdminWorker): Promise<void> {
    if (!confirmingResetId || confirmingResetId !== worker.userId) {
      setConfirmingResetId(worker.userId);
      return;
    }

    setResettingId(worker.userId);
    setResetErrors((current) => ({ ...current, [worker.userId]: '' }));

    try {
      const result = await resetUserPassword(worker.userId);
      setResetMessages((current) => ({
        ...current,
        [worker.userId]: `Link de redefinição enviado pra ${result.email}.`,
      }));
    } catch (err) {
      setResetErrors((current) => ({
        ...current,
        [worker.userId]: err instanceof ApiError ? err.message : 'Não foi possível enviar o link.',
      }));
    } finally {
      setResettingId(null);
      setConfirmingResetId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
        <CardListSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5">
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <Input
            id="search-trabalhadores"
            label="Buscar"
            type="text"
            placeholder="Nome..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={sortOrder === 'shiftsCompleted' ? 'primary' : 'outlined'}
            onClick={() => setSortOrder('shiftsCompleted')}
          >
            Mais escalas
          </Button>
          <Button
            type="button"
            variant={sortOrder === 'hoursWorked' ? 'primary' : 'outlined'}
            onClick={() => setSortOrder('hoursWorked')}
          >
            Mais horas
          </Button>
          <Button
            type="button"
            variant={sortOrder === 'recent' ? 'primary' : 'outlined'}
            onClick={() => setSortOrder('recent')}
          >
            Mais recentes
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-secondary">{workers.length} trabalhador(es) cadastrado(s)</p>

      <ul className="flex flex-col gap-3">
        {visibleWorkers.map((worker) => (
          <li
            key={worker.userId}
            className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={worker.fullName} photoUrl={worker.photoUrl} size="sm" />
                <p className="font-heading text-[16px] font-bold text-text">{worker.fullName}</p>
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                  KYC_CLASS[worker.kycStatus] ?? KYC_CLASS.pending
                }`}
              >
                {KYC_LABEL[worker.kycStatus] ?? worker.kycStatus}
              </span>
            </div>
            {worker.email && <p className="mt-1 text-sm text-text-secondary">{worker.email}</p>}
            {worker.phone && (
              <a
                href={`tel:+55${worker.phone}`}
                className="mt-0.5 block text-sm text-primary underline underline-offset-2"
              >
                {formatPhone(worker.phone)}
              </a>
            )}

            <div className="mt-2.5 flex flex-wrap gap-2 text-[14px] font-semibold text-text-secondary">
              <span className="rounded-lg bg-background px-2.5 py-1">{worker.shiftsCompleted} escala(s) concluída(s)</span>
              <span className="rounded-lg bg-background px-2.5 py-1">{worker.hoursWorked}h trabalhadas</span>
              {worker.avgRating && <span className="rounded-lg bg-background px-2.5 py-1">★ {worker.avgRating}</span>}
            </div>

            {resetMessages[worker.userId] && <p className="mt-2.5 text-sm text-success">{resetMessages[worker.userId]}</p>}
            {resetErrors[worker.userId] && <p className="mt-2.5 text-sm text-danger">{resetErrors[worker.userId]}</p>}

            <div className="mt-3.5 flex items-center gap-2">
              <Button
                type="button"
                variant={confirmingResetId === worker.userId ? 'danger' : 'outlined'}
                isLoading={resettingId === worker.userId}
                disabled={!worker.email}
                onClick={() => handleResetPassword(worker)}
              >
                {confirmingResetId === worker.userId ? 'Confirmar envio' : 'Resetar senha'}
              </Button>
              {confirmingResetId === worker.userId && resettingId !== worker.userId && (
                <button
                  type="button"
                  onClick={() => setConfirmingResetId(null)}
                  className="text-sm text-text-secondary underline underline-offset-2"
                >
                  Cancelar
                </button>
              )}
            </div>

            <ConsentHistory
              termsAcceptedAt={worker.termsAcceptedAt}
              termsVersion={worker.termsVersion}
              termsIpAddress={worker.termsIpAddress}
              loginTermsAcceptedAt={worker.loginTermsAcceptedAt}
              loginTermsVersion={worker.loginTermsVersion}
              loginTermsIpAddress={worker.loginTermsIpAddress}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
