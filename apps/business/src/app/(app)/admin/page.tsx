'use client';

import { getCurrentUser } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import {
  AdminMetrics,
  fetchDocumentImageUrl,
  getAdminMetrics,
  listPendingVerifications,
  PendingCompany,
  PendingDocument,
  reviewCompany,
  reviewDocument,
} from '../../../lib/admin-api';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const { user } = await getCurrentUser();
        if (!user.isAdmin) {
          return;
        }
        setIsAdmin(true);

        const [metricsResult, verificationsResult] = await Promise.all([
          getAdminMetrics(),
          listPendingVerifications(),
        ]);
        setMetrics(metricsResult);
        setDocuments(verificationsResult.documents);
        setCompanies(verificationsResult.companies);
      } catch {
        setError('Não foi possível carregar as verificações pendentes.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    documents.forEach((document) => {
      if (imageUrls[document.id]) return;
      fetchDocumentImageUrl(document.id)
        .then((url) => setImageUrls((current) => ({ ...current, [document.id]: url })))
        .catch(() => {
          // Sem preview nesse caso — os botões de aprovar/rejeitar continuam funcionando.
        });
    });
  }, [documents, imageUrls]);

  async function handleReviewDocument(documentId: string, status: 'approved' | 'rejected'): Promise<void> {
    setError(null);
    setActingId(documentId);

    try {
      await reviewDocument(documentId, status);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch {
      setError('Não foi possível revisar o documento.');
    } finally {
      setActingId(null);
    }
  }

  async function handleReviewCompany(companyId: string, status: 'approved' | 'rejected'): Promise<void> {
    setError(null);
    setActingId(companyId);

    try {
      await reviewCompany(companyId, status);
      setCompanies((current) => current.filter((company) => company.id !== companyId));
    } catch {
      setError('Não foi possível revisar a empresa.');
    } finally {
      setActingId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando verificações pendentes...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">Essa área é restrita a administradores.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
      {error && <p className="text-sm text-danger">{error}</p>}

      {metrics && (
        <section>
          <h2 className="font-heading text-lg font-bold text-text">Visão geral</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">
                {CURRENCY_FORMATTER.format(Number(metrics.payments.totalProcessed))}
              </p>
              <p className="mt-1 text-xs text-text-secondary">Processado (cobrado + liberado)</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.payments.countByStatus.pending}</p>
              <p className="mt-1 text-xs text-text-secondary">Pagamentos pendentes</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.payments.countByStatus.failed}</p>
              <p className="mt-1 text-xs text-text-secondary">Pagamentos falhos</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.workers.total}</p>
              <p className="mt-1 text-xs text-text-secondary">Trabalhadores cadastrados</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.workers.verified}</p>
              <p className="mt-1 text-xs text-text-secondary">Trabalhadores verificados</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.workers.active}</p>
              <p className="mt-1 text-xs text-text-secondary">Trabalharam ao menos 1 turno</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.companies.total}</p>
              <p className="mt-1 text-xs text-text-secondary">Empresas cadastradas</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.companies.jobsPosted}</p>
              <p className="mt-1 text-xs text-text-secondary">Vagas publicadas</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 text-center">
              <p className="font-heading text-xl font-bold text-text">{metrics.shifts.completed}</p>
              <p className="mt-1 text-xs text-text-secondary">Turnos concluídos (negócios fechados)</p>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-heading text-lg font-bold text-text">Documentos de trabalhadores</h2>
        {documents.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">Nenhum documento pendente.</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {documents.map((document) => (
            <li
              key={document.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <p className="font-heading text-[15.5px] font-bold text-text">{document.workerFullName}</p>
              {imageUrls[document.id] && (
                // eslint-disable-next-line @next/next/no-img-element -- vem de um blob: URL autenticado, next/image não se aplica
                <img
                  src={imageUrls[document.id]}
                  alt={`Documento de ${document.workerFullName}`}
                  className="mt-2.5 max-h-64 rounded-xl border border-border object-contain"
                />
              )}
              <div className="mt-3.5 flex gap-2">
                <Button
                  type="button"
                  variant="success"
                  isLoading={actingId === document.id}
                  onClick={() => handleReviewDocument(document.id, 'approved')}
                >
                  Aprovar
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  isLoading={actingId === document.id}
                  onClick={() => handleReviewDocument(document.id, 'rejected')}
                >
                  Rejeitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold text-text">Empresas</h2>
        {companies.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">Nenhuma empresa pendente.</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {companies.map((company) => (
            <li
              key={company.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <p className="font-heading text-[15.5px] font-bold text-text">{company.tradeName}</p>
              <p className="text-sm text-text-secondary">{company.legalName}</p>
              <p className="font-mono text-sm text-text-secondary">CNPJ {company.cnpj}</p>
              <div className="mt-3.5 flex gap-2">
                <Button
                  type="button"
                  variant="success"
                  isLoading={actingId === company.id}
                  onClick={() => handleReviewCompany(company.id, 'approved')}
                >
                  Aprovar
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  isLoading={actingId === company.id}
                  onClick={() => handleReviewCompany(company.id, 'rejected')}
                >
                  Rejeitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
