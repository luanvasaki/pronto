'use client';

import { formatCpf, formatPhone } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { CardListSkeleton } from '../../../components/ui/skeleton';
import { ZoomableDocumentImage } from '../../../components/ui/zoomable-document-image';
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
  guardian_identity: 'Documento do responsável',
};

interface WorkerDocumentGroup {
  workerId: string;
  workerFullName: string;
  isMinor: boolean;
  guardianFullName: string | null;
  guardianCpf: string | null;
  guardianPhone: string | null;
  documents: PendingDocument[];
}

/**
 * Aprovar/rejeitar aqui é definitivo (rejeitar bloqueia a conta,
 * aprovar libera na hora) — pede um segundo clique antes de chamar a
 * API, igual "Resetar senha" em admin/trabalhadores e admin/empresas: o
 * próprio botão vira o de confirmar em vez de abrir algo novo.
 */
interface ConfirmTarget {
  id: string;
  status: 'approved' | 'rejected';
}

function isConfirming(target: ConfirmTarget | null, id: string, status: 'approved' | 'rejected'): boolean {
  return target?.id === id && target.status === status;
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
        isMinor: document.isMinor,
        guardianFullName: document.guardianFullName,
        guardianCpf: document.guardianCpf,
        guardianPhone: document.guardianPhone,
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
  const [confirmingDocument, setConfirmingDocument] = useState<ConfirmTarget | null>(null);
  const [confirmingCompany, setConfirmingCompany] = useState<ConfirmTarget | null>(null);
  const [confirmingSkillCategory, setConfirmingSkillCategory] = useState<ConfirmTarget | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

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
  const flatDocuments = documentsByWorker.flatMap((group) => group.documents);

  // Derivado no render em vez de sincronizado por effect: assim que o
  // documento ativo aprovado/rejeitado sai da lista (ou antes de
  // qualquer navegação), reancora no primeiro documento restante sem
  // precisar de um setState adicional disparado por effect.
  const resolvedActiveDocumentId = flatDocuments.some((document) => document.id === activeDocumentId)
    ? activeDocumentId
    : (flatDocuments[0]?.id ?? null);

  async function handleReviewDocument(documentId: string, status: 'approved' | 'rejected'): Promise<void> {
    if (!isConfirming(confirmingDocument, documentId, status)) {
      setConfirmingDocument({ id: documentId, status });
      return;
    }

    setError(null);
    setActingId(documentId);

    try {
      await reviewDocument(documentId, status);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch {
      setError('Não foi possível revisar o documento.');
    } finally {
      setActingId(null);
      setConfirmingDocument(null);
    }
  }

  /**
   * Aprovar 10 documentos exigia 20 cliques (aprovar + confirmar, por
   * documento), sempre movendo o mouse até o próximo card. `↑`/`↓`
   * (ou `k`/`j`) troca qual documento é o "ativo" (contorno laranja);
   * `a`/`r` disparam exatamente o mesmo fluxo de aprovar/rejeitar +
   * confirmar de dois passos que o clique já usa — não é uma aprovação
   * em lote sem revisão, só remove o deslocamento de mouse entre um
   * documento e o outro. Ignorado enquanto o foco está num campo de
   * texto (ex: nome da categoria pendente), pra não capturar digitação.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target;
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (flatDocuments.length === 0) return;

      const activeIndex = flatDocuments.findIndex((document) => document.id === resolvedActiveDocumentId);

      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        const nextIndex = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, flatDocuments.length - 1);
        setActiveDocumentId(flatDocuments[nextIndex].id);
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        const previousIndex = activeIndex < 0 ? 0 : Math.max(activeIndex - 1, 0);
        setActiveDocumentId(flatDocuments[previousIndex].id);
      } else if ((event.key === 'a' || event.key === 'A') && activeIndex >= 0) {
        event.preventDefault();
        void handleReviewDocument(flatDocuments[activeIndex].id, 'approved');
      } else if ((event.key === 'r' || event.key === 'R') && activeIndex >= 0) {
        event.preventDefault();
        void handleReviewDocument(flatDocuments[activeIndex].id, 'rejected');
      } else if (event.key === 'Escape') {
        setConfirmingDocument(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  async function handleReviewCompany(companyId: string, status: 'approved' | 'rejected'): Promise<void> {
    if (!isConfirming(confirmingCompany, companyId, status)) {
      setConfirmingCompany({ id: companyId, status });
      return;
    }

    setError(null);
    setActingId(companyId);

    try {
      await reviewCompany(companyId, status);
      setCompanies((current) => current.filter((company) => company.id !== companyId));
    } catch {
      setError('Não foi possível revisar a empresa.');
    } finally {
      setActingId(null);
      setConfirmingCompany(null);
    }
  }

  async function handleReviewSkillCategory(categoryId: string, status: 'approved' | 'rejected'): Promise<void> {
    if (!isConfirming(confirmingSkillCategory, categoryId, status)) {
      setConfirmingSkillCategory({ id: categoryId, status });
      return;
    }

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
      setConfirmingSkillCategory(null);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8">
        <CardListSkeleton />
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
        {documents.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary">
            Atalhos: <span className="font-semibold">↑/↓</span> troca o documento em destaque ·{' '}
            <span className="font-semibold">A</span> aprova · <span className="font-semibold">R</span> rejeita ·{' '}
            <span className="font-semibold">Esc</span> cancela
          </p>
        )}
        {documents.length === 0 && (
          <p className="mt-2 text-sm text-text-secondary">Nenhum documento pendente.</p>
        )}
        <ul className="mt-3 flex flex-col gap-3">
          {documentsByWorker.map(
            ({ workerId, workerFullName, isMinor, guardianFullName, guardianCpf, guardianPhone, documents: workerDocuments }) => (
            <li
              key={workerId}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <p className="font-heading text-[16px] font-bold text-text">{workerFullName}</p>
              {isMinor && (
                <div className="mt-1.5 rounded-lg bg-warning/10 px-2.5 py-2 text-[14px] text-warning">
                  <p className="font-semibold">Trabalhador menor de idade (16-17 anos)</p>
                  <p className="mt-0.5">
                    Responsável: {guardianFullName ?? '—'}
                    {guardianCpf && ` · CPF ${formatCpf(guardianCpf)}`}
                    {guardianPhone && ` · ${formatPhone(guardianPhone)}`}
                  </p>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-4">
                {workerDocuments.map((document) => (
                  <div
                    key={document.id}
                    className={`flex flex-col gap-2 rounded-xl p-1.5 transition ${
                      document.id === resolvedActiveDocumentId ? 'ring-2 ring-primary' : ''
                    }`}
                  >
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
                        <ZoomableDocumentImage
                          src={documentFiles[document.id].url}
                          alt={`${DOCUMENT_TYPE_LABEL[document.type] ?? document.type} de ${workerFullName}`}
                          className="max-h-64 rounded-xl border border-border"
                        />
                      )
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={isConfirming(confirmingDocument, document.id, 'approved') ? 'danger' : 'success'}
                        isLoading={actingId === document.id}
                        onClick={() => {
                          setActiveDocumentId(document.id);
                          void handleReviewDocument(document.id, 'approved');
                        }}
                      >
                        {isConfirming(confirmingDocument, document.id, 'approved') ? 'Confirmar aprovação' : 'Aprovar'}
                      </Button>
                      <Button
                        type="button"
                        variant={isConfirming(confirmingDocument, document.id, 'rejected') ? 'danger' : 'outlined'}
                        isLoading={actingId === document.id}
                        onClick={() => {
                          setActiveDocumentId(document.id);
                          void handleReviewDocument(document.id, 'rejected');
                        }}
                      >
                        {isConfirming(confirmingDocument, document.id, 'rejected') ? 'Confirmar rejeição' : 'Rejeitar'}
                      </Button>
                      {confirmingDocument?.id === document.id && actingId !== document.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmingDocument(null)}
                          className="text-sm text-text-secondary underline underline-offset-2"
                        >
                          Cancelar
                        </button>
                      )}
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
          {companies.map((company) => {
          const cannotApprove = !company.documentId;
          return (
            <li
              key={company.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <p className="font-heading text-[16px] font-bold text-text">{company.tradeName}</p>
              <p className="text-sm text-text-secondary">{company.legalName}</p>
              <p className="font-mono text-sm text-text-secondary">
                {company.personType === 'fisica' ? `CPF ${company.cpf}` : `CNPJ ${company.cnpj}`}
              </p>
              <div className="mt-2.5">
                <span className="text-xs font-semibold text-text-secondary uppercase">
                  {company.personType === 'fisica' ? 'Documento (pessoa física)' : 'Documento (cartão CNPJ)'}
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
                      <ZoomableDocumentImage
                        src={file.url}
                        alt={`Documento de ${company.tradeName}`}
                        className="mt-1 max-h-64 rounded-xl border border-border"
                      />
                    );
                  })()
                ) : (
                  <p className="mt-1 text-sm text-danger">Nenhum documento enviado.</p>
                )}
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={isConfirming(confirmingCompany, company.id, 'approved') ? 'danger' : 'success'}
                  isLoading={actingId === company.id}
                  disabled={cannotApprove}
                  onClick={() => handleReviewCompany(company.id, 'approved')}
                >
                  {isConfirming(confirmingCompany, company.id, 'approved') ? 'Confirmar aprovação' : 'Aprovar'}
                </Button>
                <Button
                  type="button"
                  variant={isConfirming(confirmingCompany, company.id, 'rejected') ? 'danger' : 'outlined'}
                  isLoading={actingId === company.id}
                  onClick={() => handleReviewCompany(company.id, 'rejected')}
                >
                  {isConfirming(confirmingCompany, company.id, 'rejected') ? 'Confirmar rejeição' : 'Rejeitar'}
                </Button>
                {confirmingCompany?.id === company.id && actingId !== company.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmingCompany(null)}
                    className="text-sm text-text-secondary underline underline-offset-2"
                  >
                    Cancelar
                  </button>
                )}
                {cannotApprove && (
                  <span className="text-xs text-danger">Sem documento enviado — não é possível aprovar.</span>
                )}
              </div>
            </li>
          );
          })}
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
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={isConfirming(confirmingSkillCategory, category.id, 'approved') ? 'danger' : 'success'}
                  isLoading={actingId === category.id}
                  onClick={() => handleReviewSkillCategory(category.id, 'approved')}
                >
                  {isConfirming(confirmingSkillCategory, category.id, 'approved') ? 'Confirmar aprovação' : 'Aprovar'}
                </Button>
                <Button
                  type="button"
                  variant={isConfirming(confirmingSkillCategory, category.id, 'rejected') ? 'danger' : 'outlined'}
                  isLoading={actingId === category.id}
                  onClick={() => handleReviewSkillCategory(category.id, 'rejected')}
                >
                  {isConfirming(confirmingSkillCategory, category.id, 'rejected') ? 'Confirmar rejeição' : 'Rejeitar'}
                </Button>
                {confirmingSkillCategory?.id === category.id && actingId !== category.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmingSkillCategory(null)}
                    className="text-sm text-text-secondary underline underline-offset-2"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
