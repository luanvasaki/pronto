'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  DocumentFile,
  fetchCompanyDocumentFile,
  fetchDocumentFile,
  listPendingVerifications,
  PendingCompany,
  PendingDocument,
  PendingSkillCategory,
  reviewCompany,
  reviewDocument,
  reviewSkillCategory,
} from '../../../lib/admin-api';

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  identity: 'Documento (RG/CNH)',
  selfie: 'Selfie',
};

interface WorkerDocumentGroup {
  workerId: string;
  workerFullName: string;
  documents: PendingDocument[];
}

/** Identidade e selfie do mesmo trabalhador lado a lado, pra comparar antes de aprovar. */
function groupDocumentsByWorker(documents: PendingDocument[]): WorkerDocumentGroup[] {
  const groups = new Map<string, WorkerDocumentGroup>();
  for (const document of documents) {
    const group = groups.get(document.workerId);
    if (group) {
      group.documents.push(document);
    } else {
      groups.set(document.workerId, {
        workerId: document.workerId,
        workerFullName: document.workerFullName,
        documents: [document],
      });
    }
  }
  return Array.from(groups.values());
}

export default function AdminVerificacoesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [skillCategories, setSkillCategories] = useState<PendingSkillCategory[]>([]);
  const [categoryNameDrafts, setCategoryNameDrafts] = useState<Record<string, string>>({});
  const [documentFiles, setDocumentFiles] = useState<Record<string, DocumentFile>>({});
  const [companyDocumentFiles, setCompanyDocumentFiles] = useState<Record<string, DocumentFile>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    listPendingVerifications()
      .then((result) => {
        setDocuments(result.documents);
        setCompanies(result.companies);
        setSkillCategories(result.skillCategories);
        setCategoryNameDrafts(Object.fromEntries(result.skillCategories.map((category) => [category.id, category.name])));
      })
      .catch(() => setError('Não foi possível carregar as verificações pendentes.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    documents.forEach((document) => {
      if (documentFiles[document.id]) return;
      fetchDocumentFile(document.id)
        .then((file) => setDocumentFiles((current) => ({ ...current, [document.id]: file })))
        .catch(() => {
          // Sem preview nesse caso — os botões de aprovar/rejeitar continuam funcionando.
        });
    });
  }, [documents, documentFiles]);

  useEffect(() => {
    companies.forEach((company) => {
      if (!company.documentId || companyDocumentFiles[company.documentId]) return;
      fetchCompanyDocumentFile(company.documentId)
        .then((file) => setCompanyDocumentFiles((current) => ({ ...current, [company.documentId!]: file })))
        .catch(() => {
          // Sem preview nesse caso — os botões de aprovar/rejeitar continuam funcionando.
        });
    });
  }, [companies, companyDocumentFiles]);

  const documentsByWorker = groupDocumentsByWorker(documents);

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

  async function handleReviewSkillCategory(categoryId: string, status: 'approved' | 'rejected'): Promise<void> {
    setError(null);
    setActingId(categoryId);

    try {
      const name = categoryNameDrafts[categoryId];
      await reviewSkillCategory(categoryId, status, name);
      setSkillCategories((current) => current.filter((category) => category.id !== categoryId));
    } catch {
      setError('Não foi possível revisar a categoria.');
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
      {error && <p className="text-sm text-danger">{error}</p>}

      <section>
        <h2 className="font-heading text-lg font-bold text-text">Documentos de trabalhadores</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Compare a selfie com a foto do documento pra confirmar que é a mesma pessoa antes de aprovar.
        </p>
        {documents.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">Nenhum documento pendente.</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {documentsByWorker.map(({ workerId, workerFullName, documents: workerDocuments }) => (
            <li
              key={workerId}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <p className="font-heading text-[15.5px] font-bold text-text">{workerFullName}</p>
              <div className="mt-2.5 flex flex-wrap gap-4">
                {workerDocuments.map((document) => (
                  <div key={document.id} className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-secondary uppercase">
                      {DOCUMENT_TYPE_LABEL[document.type] ?? document.type}
                    </span>
                    {documentFiles[document.id] && documentFiles[document.id].contentType === 'application/pdf' ? (
                      <a
                        href={documentFiles[document.id].url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-primary underline underline-offset-2"
                      >
                        Abrir documento (PDF)
                      </a>
                    ) : (
                      documentFiles[document.id] && (
                        // eslint-disable-next-line @next/next/no-img-element -- vem de um blob: URL autenticado, next/image não se aplica
                        <img
                          src={documentFiles[document.id].url}
                          alt={`${DOCUMENT_TYPE_LABEL[document.type] ?? document.type} de ${workerFullName}`}
                          className="max-h-64 rounded-xl border border-border object-contain"
                        />
                      )
                    )}
                    <div className="flex gap-2">
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
                  </div>
                ))}
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
              <p className="font-mono text-sm text-text-secondary">
                {company.personType === 'fisica' ? `CPF ${company.cpf}` : `CNPJ ${company.cnpj}`}
              </p>
              {company.personType === 'fisica' && (
                <div className="mt-2.5">
                  <span className="text-xs font-semibold text-text-secondary uppercase">
                    Documento (pessoa física)
                  </span>
                  {company.documentId ? (
                    (() => {
                      const file = companyDocumentFiles[company.documentId];
                      if (!file) return null;
                      return file.contentType === 'application/pdf' ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-sm font-semibold text-primary underline underline-offset-2"
                        >
                          Abrir documento (PDF)
                        </a>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- vem de um blob: URL autenticado, next/image não se aplica
                        <img
                          src={file.url}
                          alt={`Documento de ${company.tradeName}`}
                          className="mt-1 max-h-64 rounded-xl border border-border object-contain"
                        />
                      );
                    })()
                  ) : (
                    <p className="mt-1 text-sm text-danger">Nenhum documento enviado.</p>
                  )}
                </div>
              )}
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

      <section>
        <h2 className="font-heading text-lg font-bold text-text">Categorias pendentes</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Criadas por empresas na hora de publicar uma vaga, quando nenhuma categoria existente servia. Já
          estão em uso — corrija o nome se precisar antes de aprovar.
        </p>
        {skillCategories.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">Nenhuma categoria pendente.</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {skillCategories.map((category) => (
            <li
              key={category.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              {category.createdByName && (
                <p className="text-xs text-text-secondary">Criada por {category.createdByName}</p>
              )}
              <Input
                id={`category-name-${category.id}`}
                label="Nome da categoria"
                type="text"
                value={categoryNameDrafts[category.id] ?? category.name}
                onChange={(event) =>
                  setCategoryNameDrafts((current) => ({ ...current, [category.id]: event.target.value }))
                }
              />
              <div className="mt-3.5 flex gap-2">
                <Button
                  type="button"
                  variant="success"
                  isLoading={actingId === category.id}
                  onClick={() => handleReviewSkillCategory(category.id, 'approved')}
                >
                  Aprovar
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  isLoading={actingId === category.id}
                  onClick={() => handleReviewSkillCategory(category.id, 'rejected')}
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
