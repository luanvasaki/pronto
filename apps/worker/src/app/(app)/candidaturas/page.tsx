'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { MapLink } from '../../../components/ui/map-link';
import { JobAnnouncement, listJobAnnouncements } from '../../../lib/announcements-api';
import { listMyApplications, MyApplication, withdrawApplication } from '../../../lib/applications-api';
import { askQuestion, JobQuestion, listJobQuestions } from '../../../lib/questions-api';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  withdrawn: 'Retirada',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  withdrawn: 'bg-border text-text-secondary',
};

/**
 * `status === 'rejected'` cobre dois casos bem diferentes pro
 * trabalhador: nunca ter sido aceito, ou ter sido aceito e depois
 * removido da escala pela empresa (bem mais grave). `removedAt` (já
 * vem do backend) diferencia os dois — mesmo padrão visual que a tela
 * de Início já usa pro alerta de remoção.
 */
function statusLabel(application: MyApplication): string {
  if (application.removedAt !== null) return 'Removida';
  return STATUS_LABEL[application.status] ?? application.status;
}

function statusClass(application: MyApplication): string {
  if (application.removedAt !== null) return 'bg-danger/10 text-danger';
  return STATUS_CLASS[application.status] ?? STATUS_CLASS.pending;
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function CandidaturasPage() {
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingWithdrawId, setConfirmingWithdrawId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [announcementsByJobId, setAnnouncementsByJobId] = useState<Record<string, JobAnnouncement[]>>({});
  const [questionsByJobId, setQuestionsByJobId] = useState<Record<string, JobQuestion[]>>({});
  const [isLoadingJobExtras, setIsLoadingJobExtras] = useState(false);
  const [newQuestionByJobId, setNewQuestionByJobId] = useState<Record<string, string>>({});
  const [isAskingJobId, setIsAskingJobId] = useState<string | null>(null);
  const [askError, setAskError] = useState<{ jobId: string; message: string } | null>(null);

  async function toggleExpanded(jobId: string): Promise<void> {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }

    setExpandedJobId(jobId);
    if (announcementsByJobId[jobId] && questionsByJobId[jobId]) return;

    setIsLoadingJobExtras(true);
    try {
      const [announcementsResult, questionsResult] = await Promise.all([
        listJobAnnouncements(jobId),
        listJobQuestions(jobId),
      ]);
      setAnnouncementsByJobId((current) => ({ ...current, [jobId]: announcementsResult.announcements }));
      setQuestionsByJobId((current) => ({ ...current, [jobId]: questionsResult.questions }));
    } catch {
      // Se falhar, a seção some vazia — o worker pode fechar e tentar de novo.
    } finally {
      setIsLoadingJobExtras(false);
    }
  }

  async function handleAskQuestion(jobId: string): Promise<void> {
    const question = newQuestionByJobId[jobId]?.trim();
    if (!question || isAskingJobId) return;

    setAskError(null);
    setIsAskingJobId(jobId);
    try {
      const created = await askQuestion(jobId, question);
      setQuestionsByJobId((current) => ({ ...current, [jobId]: [...(current[jobId] ?? []), created] }));
      setNewQuestionByJobId((current) => ({ ...current, [jobId]: '' }));
    } catch (err) {
      setAskError({
        jobId,
        message: err instanceof ApiError ? err.message : 'Não foi possível enviar sua pergunta.',
      });
    } finally {
      setIsAskingJobId(null);
    }
  }

  async function handleWithdraw(applicationId: string): Promise<void> {
    if (confirmingWithdrawId !== applicationId) {
      setConfirmingWithdrawId(applicationId);
      return;
    }

    setWithdrawError(null);
    setWithdrawingId(applicationId);
    try {
      await withdrawApplication(applicationId);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId ? { ...application, status: 'withdrawn' } : application,
        ),
      );
    } catch (err) {
      setWithdrawError(err instanceof ApiError ? err.message : 'Não foi possível cancelar a candidatura.');
    } finally {
      setWithdrawingId(null);
      setConfirmingWithdrawId(null);
    }
  }

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [applicationsResult, categoriesResult] = await Promise.all([
          listMyApplications(),
          listSkillCategories(),
        ]);
        setApplications(applicationsResult.applications);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch {
        setError('Não foi possível carregar suas candidaturas.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando suas candidaturas...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Minhas candidaturas</h1>

      {error && <p className="text-sm text-danger">{error}</p>}
      {withdrawError && <p className="text-sm text-danger">{withdrawError}</p>}

      {applications.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não se candidatou a nenhuma vaga.</p>
      )}

      <ul className="flex flex-col gap-3">
        {applications.map((application) => (
          <li
            key={application.id}
            className="rounded-[20px] border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-heading text-[17px] font-bold text-text">
                  {categoryNames[application.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                </p>
                <p className="text-[13px] font-semibold text-text-secondary">{application.companyName}</p>
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(application)}`}
              >
                {statusLabel(application)}
              </span>
            </div>
            <MapLink
              addressLabel={application.job.addressLabel}
              lat={application.job.locationLat}
              lng={application.job.locationLng}
              className="mt-1 text-sm"
            />
            <p className="mt-1 text-sm text-text-secondary">
              {formatDateRange(application.job.startsAt, application.job.endsAt)}
            </p>
            <p className="mt-2 font-heading text-lg font-bold text-primary">R$ {application.job.payAmount}</p>

            <button
              type="button"
              onClick={() => toggleExpanded(application.job.id)}
              className="mt-2.5 text-sm font-semibold text-primary underline underline-offset-2"
            >
              {expandedJobId === application.job.id ? 'Ocultar avisos e perguntas' : 'Ver avisos e perguntas'}
            </button>

            {expandedJobId === application.job.id && (
              <div className="mt-3 flex flex-col gap-4 rounded-2xl bg-background p-3">
                {isLoadingJobExtras &&
                  !announcementsByJobId[application.job.id] &&
                  !questionsByJobId[application.job.id] && (
                    <p className="text-sm text-text-secondary">Carregando...</p>
                  )}

                <div>
                  <p className="text-[13px] font-bold text-text">Avisos da empresa</p>
                  {(announcementsByJobId[application.job.id] ?? []).length === 0 ? (
                    <p className="mt-1 text-sm text-text-secondary">Nenhum aviso ainda.</p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-2">
                      {announcementsByJobId[application.job.id]!.map((announcement) => (
                        <li key={announcement.id} className="rounded-lg bg-surface p-2.5">
                          <p className="text-sm text-text">{announcement.message}</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {formatDateTime(announcement.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-[13px] font-bold text-text">Perguntas e respostas</p>
                  {(questionsByJobId[application.job.id] ?? []).length === 0 ? (
                    <p className="mt-1 text-sm text-text-secondary">Nenhuma pergunta ainda.</p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-2">
                      {questionsByJobId[application.job.id]!.map((question) => (
                        <li key={question.id} className="rounded-lg bg-surface p-2.5">
                          <p className="text-[12.5px] font-semibold text-text-secondary">
                            {question.worker.fullName}
                          </p>
                          <p className="mt-0.5 text-sm text-text">{question.question}</p>
                          {question.answer && (
                            <p className="mt-1.5 text-sm text-success">
                              <span className="font-semibold">Resposta:</span> {question.answer}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2 flex flex-col gap-1.5">
                    <textarea
                      rows={2}
                      placeholder="Faça uma pergunta pra empresa..."
                      value={newQuestionByJobId[application.job.id] ?? ''}
                      onChange={(event) =>
                        setNewQuestionByJobId((current) => ({
                          ...current,
                          [application.job.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                    />
                    {askError?.jobId === application.job.id && (
                      <p className="text-sm text-danger">{askError.message}</p>
                    )}
                    <Button
                      type="button"
                      isLoading={isAskingJobId === application.job.id}
                      disabled={!(newQuestionByJobId[application.job.id] ?? '').trim()}
                      onClick={() => handleAskQuestion(application.job.id)}
                    >
                      Perguntar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {application.status === 'pending' && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant={confirmingWithdrawId === application.id ? 'danger' : 'outlined'}
                  isLoading={withdrawingId === application.id}
                  onClick={() => handleWithdraw(application.id)}
                >
                  {confirmingWithdrawId === application.id ? 'Confirmar cancelamento' : 'Cancelar candidatura'}
                </Button>
                {confirmingWithdrawId === application.id && withdrawingId !== application.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmingWithdrawId(null)}
                    className="text-sm text-text-secondary underline underline-offset-2"
                  >
                    Voltar
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
