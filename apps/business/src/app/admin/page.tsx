'use client';

import { getCurrentUser } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { useRequireAuth } from '../../hooks/use-require-auth';
import {
  fetchDocumentImageUrl,
  listPendingVerifications,
  PendingCompany,
  PendingDocument,
  reviewCompany,
  reviewDocument,
} from '../../lib/admin-api';

export default function AdminPage() {
  const { isChecking } = useRequireAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (isChecking) return;

    async function load(): Promise<void> {
      try {
        const { user } = await getCurrentUser();
        if (!user.isAdmin) {
          return;
        }
        setIsAdmin(true);

        const result = await listPendingVerifications();
        setDocuments(result.documents);
        setCompanies(result.companies);
      } catch {
        setError('Não foi possível carregar as verificações pendentes.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [isChecking]);

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

  if (isChecking || isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : 'Carregando verificações pendentes...'}
        </p>
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Verificações pendentes</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

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
