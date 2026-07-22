'use client';

import { ApiError } from '@shift/shared';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { ConsentHistory } from '../../../components/ui/consent-history';
import { Input } from '../../../components/ui/input';
import { CardListSkeleton } from '../../../components/ui/skeleton';
import { AdminCompany, listAdminCompanies, resetUserPassword } from '../../../lib/admin-api';

const VERIFICATION_LABEL: Record<string, string> = {
  pending: 'Verificação pendente',
  approved: 'Verificada',
  rejected: 'Verificação recusada',
};

const VERIFICATION_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

type SortOrder = 'shiftsCompleted' | 'recent';

export default function AdminEmpresasPage() {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('shiftsCompleted');

  const [confirmingResetId, setConfirmingResetId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetMessages, setResetMessages] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    listAdminCompanies()
      .then((result) => setCompanies(result.companies))
      .catch(() => setError('Não foi possível carregar as empresas.'))
      .finally(() => setIsLoading(false));
  }, []);

  const visibleCompanies = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? companies.filter(
          (company) =>
            company.tradeName.toLowerCase().includes(term) ||
            company.legalName.toLowerCase().includes(term) ||
            (company.cnpj?.includes(term) ?? false) ||
            (company.cpf?.includes(term) ?? false),
        )
      : companies;

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.shiftsCompleted - a.shiftsCompleted;
    });
  }, [companies, search, sortOrder]);

  async function handleResetPassword(company: AdminCompany): Promise<void> {
    if (!confirmingResetId || confirmingResetId !== company.id) {
      setConfirmingResetId(company.id);
      return;
    }

    setResettingId(company.id);
    setResetErrors((current) => ({ ...current, [company.id]: '' }));

    try {
      const result = await resetUserPassword(company.ownerUserId);
      setResetMessages((current) => ({
        ...current,
        [company.id]: `Link de redefinição enviado pra ${result.email}.`,
      }));
    } catch (err) {
      setResetErrors((current) => ({
        ...current,
        [company.id]: err instanceof ApiError ? err.message : 'Não foi possível enviar o link.',
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
            id="search-empresas"
            label="Buscar"
            type="text"
            placeholder="Nome, razão social, CNPJ ou CPF..."
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
            variant={sortOrder === 'recent' ? 'primary' : 'outlined'}
            onClick={() => setSortOrder('recent')}
          >
            Mais recentes
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-secondary">{companies.length} empresa(s) cadastrada(s)</p>

      <ul className="flex flex-col gap-3">
        {visibleCompanies.map((company) => (
          <li
            key={company.id}
            className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={company.tradeName} photoUrl={company.logoUrl} size="sm" shape="square" />
                <div>
                  <p className="font-heading text-[16px] font-bold text-text">{company.tradeName}</p>
                  <p className="text-sm text-text-secondary">{company.legalName}</p>
                </div>
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                  VERIFICATION_CLASS[company.verificationStatus] ?? VERIFICATION_CLASS.pending
                }`}
              >
                {VERIFICATION_LABEL[company.verificationStatus] ?? company.verificationStatus}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm text-text-secondary">
              {company.personType === 'fisica' ? `CPF ${company.cpf}` : `CNPJ ${company.cnpj}`}
            </p>
            {company.ownerEmail && <p className="mt-1 text-sm text-text-secondary">{company.ownerEmail}</p>}

            <div className="mt-2.5 flex flex-wrap gap-2 text-[14px] font-semibold text-text-secondary">
              <span className="rounded-lg bg-background px-2.5 py-1">{company.jobsPosted} vaga(s) publicada(s)</span>
              <span className="rounded-lg bg-background px-2.5 py-1">{company.shiftsCompleted} escala(s) concluída(s)</span>
              {company.avgRating && <span className="rounded-lg bg-background px-2.5 py-1">★ {company.avgRating}</span>}
            </div>

            {resetMessages[company.id] && <p className="mt-2.5 text-sm text-success">{resetMessages[company.id]}</p>}
            {resetErrors[company.id] && <p className="mt-2.5 text-sm text-danger">{resetErrors[company.id]}</p>}

            <div className="mt-3.5 flex items-center gap-2">
              <Button
                type="button"
                variant={confirmingResetId === company.id ? 'danger' : 'outlined'}
                isLoading={resettingId === company.id}
                disabled={!company.ownerEmail}
                onClick={() => handleResetPassword(company)}
              >
                {confirmingResetId === company.id ? 'Confirmar envio' : 'Resetar senha'}
              </Button>
              {confirmingResetId === company.id && resettingId !== company.id && (
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
              termsAcceptedAt={company.termsAcceptedAt}
              termsVersion={company.termsVersion}
              termsIpAddress={company.termsIpAddress}
              loginTermsAcceptedAt={company.loginTermsAcceptedAt}
              loginTermsVersion={company.loginTermsVersion}
              loginTermsIpAddress={company.loginTermsIpAddress}
              minorsTermsJobs={company.minorsTermsJobs}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
