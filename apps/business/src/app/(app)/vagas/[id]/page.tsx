'use client';

import { ApiError, rateShift, WORKER_RATING_CATEGORIES } from '@shift/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RatingForm, RatingSummary } from '../../../../components/rating-form';
import { Avatar } from '../../../../components/ui/avatar';
import { Button } from '../../../../components/ui/button';
import {
  JobApplication,
  listJobApplications,
  releasePayment,
  removeApprovedWorker,
  updateApplicationStatus,
} from '../../../../lib/applications-api';

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

export default function VagaCandidatosPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [ratingSubmittingId, setRatingSubmittingId] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<{ shiftId: string; message: string } | null>(null);

  const [releasingShiftId, setReleasingShiftId] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<{ shiftId: string; message: string } | null>(null);

  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    listJobApplications(jobId)
      .then((result) => setApplications(result.applications))
      .catch(() => setError('Não foi possível carregar os candidatos.'))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  async function handleDecision(applicationId: string, status: 'approved' | 'rejected'): Promise<void> {
    setActionError(null);
    setUpdatingId(applicationId);

    try {
      await updateApplicationStatus(applicationId, status);
      // Recarrega em vez de só mesclar o status local — aprovar cria um
      // turno no backend, e só um refetch traz esse dado novo.
      const refreshed = await listJobApplications(jobId);
      setApplications(refreshed.applications);
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

  async function handleReleasePayment(applicationId: string, shiftId: string): Promise<void> {
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

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando candidatos...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4">

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
                <p className="font-heading text-[15.5px] font-bold text-text">{application.worker.fullName}</p>
                {application.worker.avgRating && (
                  <p className="text-[12.5px] text-text-secondary">★ {application.worker.avgRating}</p>
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
                      className="rounded-lg bg-background px-2 py-1 text-[11.5px] font-semibold text-text-secondary"
                    >
                      ★{score} {category.label}
                    </span>,
                  ];
                })}
              </div>
            )}

            {application.worker.previousShiftsWithCompany > 0 && (
              <p className="mt-2.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-success">
                ✓ Já trabalhou {application.worker.previousShiftsWithCompany}x com você
              </p>
            )}

            {!application.worker.matchesSkills && (
              <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
                Esse profissional não tem essa especialidade no perfil dele.
              </p>
            )}

            {application.experienceMismatch && (
              <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
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

            {actionError?.id === application.id && (
              <p className="mt-2 text-sm text-danger">{actionError.message}</p>
            )}

            {application.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="success"
                  isLoading={updatingId === application.id}
                  onClick={() => handleDecision(application.id, 'approved')}
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
                <Button
                  type="button"
                  variant="outlined"
                  isLoading={releasingShiftId === application.shift.id}
                  onClick={() => handleReleasePayment(application.id, application.shift!.id)}
                >
                  Marcar como pago
                </Button>
              </div>
            )}

            {application.shift?.status === 'completed' && application.shift.ratings.company && (
              <RatingSummary rating={application.shift.ratings.company} categories={WORKER_RATING_CATEGORIES} />
            )}

            {application.shift?.status === 'completed' && !application.shift.ratings.company && (
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
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
