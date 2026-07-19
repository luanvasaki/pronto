'use client';

import { ApiError, formatBenefitLabel, rateShift, WORKER_RATING_CATEGORIES } from '@shift/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RatingForm, RatingSummary } from '../../../../components/rating-form';
import { Avatar } from '../../../../components/ui/avatar';
import { Button } from '../../../../components/ui/button';
import { CardListSkeleton } from '../../../../components/ui/skeleton';
import { createAnnouncement, JobAnnouncement, listJobAnnouncements } from '../../../../lib/announcements-api';
import {
  confirmCheckIn,
  confirmCheckOut,
  JobApplication,
  listJobApplications,
  releasePayment,
  removeApprovedWorker,
  skipRating,
  updateApplicationStatus,
} from '../../../../lib/applications-api';
import { Job, listMyJobs } from '../../../../lib/jobs-api';
import { answerQuestion, JobQuestion, listJobQuestions } from '../../../../lib/questions-api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  withdrawn: 'Retirada',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
  withdrawn: 'bg-border text-text-secondary',
};

/** "Removido" (empresa desfez a aprovação) é visualmente diferente de uma rejeição comum. */
function statusLabel(application: JobApplication): string {
  if (application.status === 'rejected' && application.removedAt) {
    return 'Removido';
  }
  return STATUS_LABEL[application.status] ?? application.status;
}

function statusClass(application: JobApplication): string {
  if (application.status === 'rejected' && application.removedAt) {
    return 'bg-border text-text-secondary';
  }
  return STATUS_CLASS[application.status] ?? STATUS_CLASS.pending;
}

const SHIFT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Aguardando check-in',
  checked_in: 'Em andamento',
  checked_out: 'Aguardando confirmação de saída',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  cancelled: 'Cancelado',
};

/**
 * Não existe cobrança pela plataforma (decisão de produto: pagamento é
 * acertado direto entre empresa e trabalhador) — os rótulos refletem
 * isso, mesmo que o campo por trás ainda seja `payment.status`.
 */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando conclusão da escala',
  charged: 'Escala concluída — combine o pagamento com o profissional',
  released: 'Marcado como pago — aguardando confirmação do profissional',
  confirmed: 'Profissional confirmou o recebimento',
  disputed: 'Profissional avisou que não recebeu',
  failed: 'Não foi possível registrar o acerto',
  refunded: 'Acerto cancelado',
};

interface RatingDraft {
  scores: Record<string, number>;
  comment: string;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function VagaCandidatosPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [confirmingApproveId, setConfirmingApproveId] = useState<string | null>(null);

  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [ratingSubmittingId, setRatingSubmittingId] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<{ shiftId: string; message: string } | null>(null);

  const [releasingShiftId, setReleasingShiftId] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<{ shiftId: string; message: string } | null>(null);

  const [confirmingCheckInShiftId, setConfirmingCheckInShiftId] = useState<string | null>(null);
  const [checkInConfirmError, setCheckInConfirmError] = useState<{ shiftId: string; message: string } | null>(null);

  const [confirmingCheckOutDialogShiftId, setConfirmingCheckOutDialogShiftId] = useState<string | null>(null);
  const [confirmingCheckOutShiftId, setConfirmingCheckOutShiftId] = useState<string | null>(null);
  const [checkOutConfirmError, setCheckOutConfirmError] = useState<{ shiftId: string; message: string } | null>(
    null,
  );

  const [skippingRatingShiftId, setSkippingRatingShiftId] = useState<string | null>(null);
  const [skipRatingError, setSkipRatingError] = useState<{ shiftId: string; message: string } | null>(null);
  // Depois de ignorada, a pessoa ainda pode mudar de ideia e avaliar —
  // esse set só controla se o formulário volta a aparecer nessa sessão,
  // não desfaz o skip no backend (a avaliação em si sobrescreve o que
  // importa quando enviada).
  const [showFormAfterSkip, setShowFormAfterSkip] = useState<Set<string>>(new Set());

  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [confirmingReleaseShiftId, setConfirmingReleaseShiftId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{ id: string; message: string } | null>(null);

  const [announcements, setAnnouncements] = useState<JobAnnouncement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementsLoadError, setAnnouncementsLoadError] = useState(false);

  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<{ id: string; message: string } | null>(null);
  const [questionsLoadError, setQuestionsLoadError] = useState(false);

  function loadAnnouncements(): void {
    setAnnouncementsLoadError(false);
    listJobAnnouncements(jobId)
      .then((result) => setAnnouncements(result.announcements))
      .catch(() => setAnnouncementsLoadError(true));
  }

  function loadQuestions(): void {
    setQuestionsLoadError(false);
    listJobQuestions(jobId)
      .then((result) => setQuestions(result.questions))
      .catch(() => setQuestionsLoadError(true));
  }

  useEffect(() => {
    Promise.all([listJobApplications(jobId), listMyJobs()])
      .then(([applicationsResult, jobsResult]) => {
        setApplications(applicationsResult.applications);
        setJob(jobsResult.jobs.find((j) => j.id === jobId) ?? null);
      })
      .catch(() => setError('Não foi possível carregar os candidatos.'))
      .finally(() => setIsLoading(false));

    // Não usa loadAnnouncements()/loadQuestions() aqui (só nos botões
    // de "tentar de novo") — elas resetam o erro de forma síncrona, o
    // que não faz sentido no efeito de carga inicial (o erro já começa
    // false) e o React não recomenda setState síncrono direto no corpo
    // do efeito.
    listJobAnnouncements(jobId)
      .then((result) => setAnnouncements(result.announcements))
      .catch(() => setAnnouncementsLoadError(true));
    listJobQuestions(jobId)
      .then((result) => setQuestions(result.questions))
      .catch(() => setQuestionsLoadError(true));
  }, [jobId]);

  async function handlePostAnnouncement(): Promise<void> {
    const message = newAnnouncement.trim();
    if (!message || isPostingAnnouncement) return;

    setAnnouncementError(null);
    setIsPostingAnnouncement(true);
    try {
      const announcement = await createAnnouncement(jobId, message);
      setAnnouncements((current) => [announcement, ...current]);
      setNewAnnouncement('');
    } catch (err) {
      setAnnouncementError(err instanceof ApiError ? err.message : 'Não foi possível publicar o aviso.');
    } finally {
      setIsPostingAnnouncement(false);
    }
  }

  async function handleAnswerQuestion(questionId: string): Promise<void> {
    const answer = answerDrafts[questionId]?.trim();
    if (!answer || answeringId) return;

    setAnswerError(null);
    setAnsweringId(questionId);
    try {
      const updated = await answerQuestion(questionId, answer);
      setQuestions((current) => current.map((question) => (question.id === questionId ? updated : question)));
      setAnswerDrafts((current) => ({ ...current, [questionId]: '' }));
    } catch (err) {
      setAnswerError({
        id: questionId,
        message: err instanceof ApiError ? err.message : 'Não foi possível enviar a resposta.',
      });
    } finally {
      setAnsweringId(null);
    }
  }

  const positionsFilled = applications.filter((application) => application.status === 'approved').length;

  async function handleDecision(applicationId: string, status: 'approved' | 'rejected'): Promise<void> {
    setActionError(null);
    setUpdatingId(applicationId);

    try {
      await updateApplicationStatus(applicationId, status);
      // Recarrega em vez de só mesclar o status local — aprovar cria um
      // turno no backend, e só um refetch traz esse dado novo.
      const refreshed = await listJobApplications(jobId);
      setApplications(refreshed.applications);
      setConfirmingApproveId(null);
    } catch (err) {
      setActionError({
        id: applicationId,
        message: err instanceof ApiError ? err.message : 'Não foi possível atualizar a candidatura.',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(applicationId: string): Promise<void> {
    setRemoveError(null);
    setRemovingId(applicationId);

    try {
      await removeApprovedWorker(applicationId);
      const refreshed = await listJobApplications(jobId);
      setApplications(refreshed.applications);
      setConfirmingRemoveId(null);
    } catch (err) {
      setRemoveError({
        id: applicationId,
        message: err instanceof ApiError ? err.message : 'Não foi possível remover esse candidato.',
      });
    } finally {
      setRemovingId(null);
    }
  }

  function setRatingScore(shiftId: string, categoryId: string, score: number): void {
    setRatingDrafts((current) => ({
      ...current,
      [shiftId]: {
        scores: { ...current[shiftId]?.scores, [categoryId]: score },
        comment: current[shiftId]?.comment ?? '',
      },
    }));
  }

  function setRatingComment(shiftId: string, comment: string): void {
    setRatingDrafts((current) => ({
      ...current,
      [shiftId]: { scores: current[shiftId]?.scores ?? {}, comment },
    }));
  }

  async function handleRate(applicationId: string, shiftId: string): Promise<void> {
    const draft = ratingDrafts[shiftId];
    const isComplete = WORKER_RATING_CATEGORIES.every((category) => Boolean(draft?.scores[category.id]));
    if (!draft || !isComplete) return;

    setRatingError(null);
    setRatingSubmittingId(shiftId);

    try {
      const rating = await rateShift(shiftId, draft.scores, draft.comment.trim() || undefined);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId && application.shift
            ? { ...application, shift: { ...application.shift, ratings: { ...application.shift.ratings, company: rating } } }
            : application,
        ),
      );
    } catch (err) {
      setRatingError({
        shiftId,
        message:
          err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível enviar a avaliação.',
      });
    } finally {
      setRatingSubmittingId(null);
    }
  }

  async function handleSkipRating(applicationId: string, shiftId: string): Promise<void> {
    setSkipRatingError(null);
    setSkippingRatingShiftId(shiftId);

    try {
      const result = await skipRating(shiftId);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId && application.shift
            ? { ...application, shift: { ...application.shift, companyRatingSkippedAt: result.companyRatingSkippedAt } }
            : application,
        ),
      );
    } catch (err) {
      setSkipRatingError({
        shiftId,
        message: err instanceof ApiError ? err.message : 'Não foi possível ignorar a avaliação.',
      });
    } finally {
      setSkippingRatingShiftId(null);
    }
  }

  function handleShowFormAfterSkip(shiftId: string): void {
    setShowFormAfterSkip((current) => new Set(current).add(shiftId));
  }

  async function handleReleasePayment(applicationId: string, shiftId: string): Promise<void> {
    setConfirmingReleaseShiftId(null);
    setReleaseError(null);
    setReleasingShiftId(shiftId);

    try {
      const payment = await releasePayment(shiftId);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId && application.shift
            ? { ...application, shift: { ...application.shift, payment } }
            : application,
        ),
      );
    } catch (err) {
      setReleaseError({
        shiftId,
        message: err instanceof ApiError ? err.message : 'Não foi possível marcar como pago.',
      });
    } finally {
      setReleasingShiftId(null);
    }
  }

  async function handleConfirmCheckIn(applicationId: string, shiftId: string): Promise<void> {
    setCheckInConfirmError(null);
    setConfirmingCheckInShiftId(shiftId);

    try {
      const result = await confirmCheckIn(shiftId);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId && application.shift
            ? { ...application, shift: { ...application.shift, checkInConfirmedAt: result.checkInConfirmedAt } }
            : application,
        ),
      );
    } catch (err) {
      setCheckInConfirmError({
        shiftId,
        message: err instanceof ApiError ? err.message : 'Não foi possível confirmar a chegada.',
      });
    } finally {
      setConfirmingCheckInShiftId(null);
    }
  }

  async function handleConfirmCheckOut(applicationId: string, shiftId: string): Promise<void> {
    setConfirmingCheckOutDialogShiftId(null);
    setCheckOutConfirmError(null);
    setConfirmingCheckOutShiftId(shiftId);

    try {
      const result = await confirmCheckOut(shiftId);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId && application.shift
            ? {
                ...application,
                shift: {
                  ...application.shift,
                  status: result.status,
                  checkOutConfirmedAt: result.checkOutConfirmedAt,
                },
              }
            : application,
        ),
      );
    } catch (err) {
      setCheckOutConfirmError({
        shiftId,
        message: err instanceof ApiError ? err.message : 'Não foi possível confirmar a saída.',
      });
    } finally {
      setConfirmingCheckOutShiftId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <CardListSkeleton />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4">

      {job && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[14px] font-semibold text-text">
            <span className="h-[7px] w-[7px] rounded-full bg-success" />
            {positionsFilled} de {job.positionsTotal} vagas preenchidas
          </span>
          {formatBenefitLabel(job.mealProvision, job.mealAmount, 'Alimentação') && (
            <span className="rounded-full bg-background px-3 py-1.5 text-[14px] font-semibold text-text">
              {formatBenefitLabel(job.mealProvision, job.mealAmount, 'Alimentação')}
            </span>
          )}
          {formatBenefitLabel(job.transportProvision, job.transportAmount, 'Transporte') && (
            <span className="rounded-full bg-background px-3 py-1.5 text-[14px] font-semibold text-text">
              {formatBenefitLabel(job.transportProvision, job.transportAmount, 'Transporte')}
            </span>
          )}
          {job.minorsAllowed && (
            <span className="rounded-full bg-background px-3 py-1.5 text-[14px] font-semibold text-text">
              Disponível pra menores de idade
            </span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {applications.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Ninguém se candidatou a essa vaga ainda.</p>
      )}

      <ul className="flex flex-col gap-3">
        {applications.map((application) => (
          <li
            key={application.id}
            className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
          >
            <div className="flex items-center gap-3.5">
              <Avatar name={application.worker.fullName} photoUrl={application.worker.photoUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[16px] font-bold text-text">{application.worker.fullName}</p>
                {application.worker.avgRating && (
                  <p className="text-[14px] text-text-secondary">★ {application.worker.avgRating}</p>
                )}
              </div>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(application)}`}>
                {statusLabel(application)}
              </span>
            </div>

            {application.worker.avgCategoryScores && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {WORKER_RATING_CATEGORIES.flatMap((category) => {
                  const score = application.worker.avgCategoryScores?.[category.id];
                  if (!score) return [];
                  return [
                    <span
                      key={category.id}
                      className="rounded-lg bg-background px-2 py-1 text-[11px] font-semibold text-text-secondary"
                    >
                      ★{score} {category.label}
                    </span>,
                  ];
                })}
              </div>
            )}

            {application.worker.previousShiftsWithCompany > 0 && (
              <p className="mt-2.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-[14px] font-semibold text-success">
                ✓ Já trabalhou {application.worker.previousShiftsWithCompany}x com você
              </p>
            )}

            {!application.worker.matchesSkills && (
              <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[14px] font-semibold text-danger">
                Esse profissional não tem essa especialidade no perfil dele.
              </p>
            )}

            {application.experienceMismatch && (
              <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[14px] font-semibold text-danger">
                Essa vaga exige experiência anterior e esse profissional não declarou ter.
              </p>
            )}

            {application.shift && (
              <p className="mt-2 text-sm text-text-secondary">
                Escala: {SHIFT_STATUS_LABEL[application.shift.status] ?? application.shift.status}
              </p>
            )}

            {application.shift?.payment && (
              <p
                className={`mt-1 text-sm ${
                  application.shift.payment.status === 'disputed' ? 'font-semibold text-danger' : 'text-text-secondary'
                }`}
              >
                {PAYMENT_STATUS_LABEL[application.shift.payment.status] ?? application.shift.payment.status}
              </p>
            )}

            {application.shift &&
              (application.shift.status === 'checked_in' || application.shift.status === 'checked_out') &&
              !application.shift.checkInConfirmedAt && (
                <div className="mt-2.5">
                  {checkInConfirmError?.shiftId === application.shift.id && (
                    <p className="mb-2 text-sm text-danger">{checkInConfirmError.message}</p>
                  )}
                  <Button
                    type="button"
                    variant="outlined"
                    isLoading={confirmingCheckInShiftId === application.shift.id}
                    onClick={() => handleConfirmCheckIn(application.id, application.shift!.id)}
                  >
                    Confirmar chegada
                  </Button>
                </div>
              )}

            {application.shift?.status === 'checked_out' && !application.shift.checkOutConfirmedAt && (
              <div className="mt-2.5">
                {checkOutConfirmError?.shiftId === application.shift.id && (
                  <p className="mb-2 text-sm text-danger">{checkOutConfirmError.message}</p>
                )}
                {confirmingCheckOutDialogShiftId === application.shift.id ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-primary/40 p-3">
                    <p className="text-sm text-text">
                      Confirma que {application.worker.fullName} realmente cumpriu a escala até o fim? Isso libera a
                      cobrança do turno.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        isLoading={confirmingCheckOutShiftId === application.shift.id}
                        onClick={() => handleConfirmCheckOut(application.id, application.shift!.id)}
                      >
                        Sim, confirmar saída
                      </Button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCheckOutDialogShiftId(null)}
                        className="text-sm text-text-secondary underline underline-offset-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setConfirmingCheckOutDialogShiftId(application.shift!.id)}
                  >
                    Confirmar saída
                  </Button>
                )}
              </div>
            )}

            {actionError?.id === application.id && (
              <p className="mt-2 text-sm text-danger">{actionError.message}</p>
            )}

            {application.status === 'pending' && (
              <div className="mt-3">
                {confirmingApproveId === application.id ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-success/40 p-3">
                    <p className="text-sm text-text">
                      Aprovar cria a escala de verdade pra {application.worker.fullName}. Confirma?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="success"
                        isLoading={updatingId === application.id}
                        onClick={() => handleDecision(application.id, 'approved')}
                      >
                        Sim, aprovar
                      </Button>
                      <button
                        type="button"
                        onClick={() => setConfirmingApproveId(null)}
                        className="text-sm text-text-secondary underline underline-offset-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="success"
                      onClick={() => setConfirmingApproveId(application.id)}
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      isLoading={updatingId === application.id}
                      onClick={() => handleDecision(application.id, 'rejected')}
                    >
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {application.status === 'approved' &&
              (!application.shift || application.shift.status === 'scheduled') && (
                <div className="mt-3">
                  {removeError?.id === application.id && (
                    <p className="mb-2 text-sm text-danger">{removeError.message}</p>
                  )}
                  {confirmingRemoveId === application.id ? (
                    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-danger/40 p-3">
                      <p className="text-sm text-text">
                        Tem certeza? A vaga fica aberta de novo pra outro candidato.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="danger"
                          isLoading={removingId === application.id}
                          onClick={() => handleRemove(application.id)}
                        >
                          Sim, remover
                        </Button>
                        <button
                          type="button"
                          onClick={() => setConfirmingRemoveId(null)}
                          className="text-sm text-text-secondary underline underline-offset-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="outlined" onClick={() => setConfirmingRemoveId(application.id)}>
                      Remover candidato
                    </Button>
                  )}
                </div>
              )}

            {application.shift?.payment?.status === 'charged' && (
              <div className="mt-3">
                {releaseError?.shiftId === application.shift.id && (
                  <p className="mb-2 text-sm text-danger">{releaseError.message}</p>
                )}
                {confirmingReleaseShiftId === application.shift.id ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-danger/40 p-3">
                    <p className="text-sm text-text">
                      Confirma que o pagamento já foi feito de verdade pro profissional? Essa ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        isLoading={releasingShiftId === application.shift.id}
                        onClick={() => handleReleasePayment(application.id, application.shift!.id)}
                      >
                        Sim, marcar como pago
                      </Button>
                      <button
                        type="button"
                        onClick={() => setConfirmingReleaseShiftId(null)}
                        className="text-sm text-text-secondary underline underline-offset-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setConfirmingReleaseShiftId(application.shift!.id)}
                  >
                    Marcar como pago
                  </Button>
                )}
              </div>
            )}

            {application.shift?.status === 'completed' && application.shift.ratings.company && (
              <RatingSummary rating={application.shift.ratings.company} categories={WORKER_RATING_CATEGORIES} />
            )}

            {application.shift?.status === 'completed' &&
              !application.shift.ratings.company &&
              application.shift.companyRatingSkippedAt &&
              !showFormAfterSkip.has(application.shift.id) && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-dashed border-border p-3">
                  <p className="text-sm text-text-secondary">Você optou por não avaliar esse profissional.</p>
                  <button
                    type="button"
                    onClick={() => handleShowFormAfterSkip(application.shift!.id)}
                    className="w-fit text-sm font-semibold text-primary underline underline-offset-2"
                  >
                    Avaliar mesmo assim
                  </button>
                </div>
              )}

            {application.shift?.status === 'completed' &&
              !application.shift.ratings.company &&
              (!application.shift.companyRatingSkippedAt || showFormAfterSkip.has(application.shift.id)) && (
                <>
                  <RatingForm
                    title="Avaliar o trabalhador"
                    categories={WORKER_RATING_CATEGORIES}
                    scores={ratingDrafts[application.shift.id]?.scores ?? {}}
                    comment={ratingDrafts[application.shift.id]?.comment ?? ''}
                    onChangeScore={(categoryId, score) => setRatingScore(application.shift!.id, categoryId, score)}
                    onChangeComment={(comment) => setRatingComment(application.shift!.id, comment)}
                    onSubmit={() => handleRate(application.id, application.shift!.id)}
                    isSubmitting={ratingSubmittingId === application.shift.id}
                    error={ratingError?.shiftId === application.shift.id ? ratingError.message : undefined}
                  />
                  {skipRatingError?.shiftId === application.shift.id && (
                    <p className="mt-1.5 text-sm text-danger">{skipRatingError.message}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSkipRating(application.id, application.shift!.id)}
                    disabled={skippingRatingShiftId === application.shift.id}
                    className="mt-1.5 w-fit text-sm text-text-secondary underline underline-offset-2 disabled:opacity-50"
                  >
                    {skippingRatingShiftId === application.shift.id ? 'Ignorando...' : 'Agora não'}
                  </button>
                </>
              )}
          </li>
        ))}
      </ul>

      <section className="mt-2 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <p className="font-heading text-[16px] font-bold text-text">Quadro de avisos</p>
        <p className="text-[14px] text-text-secondary">
          Publique avisos pra quem se candidatou — todo mundo que se inscreveu (mesmo já rejeitado ou aprovado)
          consegue ler, a qualquer momento.
        </p>

        <textarea
          rows={2}
          placeholder="Ex.: o local de encontro mudou, chegar 15 min antes..."
          value={newAnnouncement}
          onChange={(event) => setNewAnnouncement(event.target.value)}
          className="w-full rounded-sm border border-border bg-background px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
        />
        {announcementError && <p className="text-sm text-danger">{announcementError}</p>}
        <Button
          type="button"
          isLoading={isPostingAnnouncement}
          disabled={newAnnouncement.trim().length === 0}
          onClick={handlePostAnnouncement}
        >
          Publicar aviso
        </Button>

        {announcementsLoadError && (
          <p className="text-sm text-danger">
            Não foi possível carregar os avisos.{' '}
            <button type="button" onClick={loadAnnouncements} className="underline underline-offset-2">
              Tentar de novo
            </button>
          </p>
        )}

        {announcements.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2.5">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="rounded-xl bg-background p-3">
                <p className="text-sm text-text">{announcement.message}</p>
                <p className="mt-1 text-xs text-text-secondary">{formatDateTime(announcement.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-2 mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <p className="font-heading text-[16px] font-bold text-text">Perguntas e respostas</p>
        <p className="text-[14px] text-text-secondary">
          Perguntas de quem se candidatou — as respostas ficam visíveis pra todos os inscritos, não só quem
          perguntou.
        </p>

        {questionsLoadError && (
          <p className="text-sm text-danger">
            Não foi possível carregar as perguntas.{' '}
            <button type="button" onClick={loadQuestions} className="underline underline-offset-2">
              Tentar de novo
            </button>
          </p>
        )}

        {!questionsLoadError && questions.length === 0 && (
          <p className="text-sm text-text-secondary">Nenhuma pergunta ainda.</p>
        )}

        <ul className="flex flex-col gap-3">
          {questions.map((question) => (
            <li key={question.id} className="rounded-xl bg-background p-3">
              <p className="text-[14px] font-semibold text-text-secondary">{question.worker.fullName}</p>
              <p className="mt-0.5 text-sm text-text">{question.question}</p>

              {question.answer ? (
                <div className="mt-2 rounded-lg bg-surface p-2.5">
                  <p className="text-[14px] font-semibold text-success">Sua resposta</p>
                  <p className="mt-0.5 text-sm text-text">{question.answer}</p>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    rows={2}
                    placeholder="Escreva a resposta..."
                    value={answerDrafts[question.id] ?? ''}
                    onChange={(event) =>
                      setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    className="w-full rounded-sm border border-border bg-surface px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                  />
                  {answerError?.id === question.id && <p className="text-sm text-danger">{answerError.message}</p>}
                  <Button
                    type="button"
                    isLoading={answeringId === question.id}
                    disabled={!(answerDrafts[question.id] ?? '').trim()}
                    onClick={() => handleAnswerQuestion(question.id)}
                  >
                    Responder
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
