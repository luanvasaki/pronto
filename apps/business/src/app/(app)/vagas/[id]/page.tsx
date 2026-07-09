'use client';

import { ApiError } from '@shift/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../../components/ui/avatar';
import { Button } from '../../../../components/ui/button';
import {
  JobApplication,
  listJobApplications,
  rateShift,
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
  pending: 'Aguardando conclusão do turno',
  charged: 'Turno concluído — combine o pagamento com o profissional',
  released: 'Marcado como pago — aguardando confirmação do profissional',
  confirmed: 'Profissional confirmou o recebimento',
  disputed: 'Profissional avisou que não recebeu',
  failed: 'Não foi possível registrar o acerto',
  refunded: 'Acerto cancelado',
};

const RATING_SCORES = [1, 2, 3, 4, 5];

interface RatingDraft {
  score: number;
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

  function setRatingScore(shiftId: string, score: number): void {
    setRatingDrafts((current) => ({ ...current, [shiftId]: { score, comment: current[shiftId]?.comment ?? '' } }));
  }

  function setRatingComment(shiftId: string, comment: string): void {
    setRatingDrafts((current) => ({ ...current, [shiftId]: { score: current[shiftId]?.score ?? 0, comment } }));
  }

  async function handleRate(applicationId: string, shiftId: string): Promise<void> {
    const draft = ratingDrafts[shiftId];
    if (!draft?.score) return;

    setRatingError(null);
    setRatingSubmittingId(shiftId);

    try {
      const rating = await rateShift(shiftId, draft.score, draft.comment.trim() || undefined);
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
                Turno: {SHIFT_STATUS_LABEL[application.shift.status] ?? application.shift.status}
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
              <p className="mt-3 text-sm text-success">
                Você avaliou: {application.shift.ratings.company.score} de 5.
              </p>
            )}

            {application.shift?.status === 'completed' && !application.shift.ratings.company && (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border p-4">
                <p className="font-heading text-[15px] font-bold text-text">Avaliar o trabalhador</p>
                <div className="flex gap-1.5" role="group" aria-label="Nota de 1 a 5">
                  {RATING_SCORES.map((score) => {
                    const shiftId = application.shift!.id;
                    const selected = (ratingDrafts[shiftId]?.score ?? 0) >= score;
                    return (
                      <button
                        key={score}
                        type="button"
                        aria-label={`${score} de 5`}
                        aria-pressed={selected}
                        onClick={() => setRatingScore(shiftId, score)}
                        className={`text-4xl leading-none transition ${
                          selected ? 'text-primary' : 'text-border'
                        }`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
                <textarea
                  rows={2}
                  placeholder="Escreva um comentário (opcional)"
                  value={ratingDrafts[application.shift.id]?.comment ?? ''}
                  onChange={(event) => setRatingComment(application.shift!.id, event.target.value)}
                  className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                />
                {ratingError?.shiftId === application.shift.id && (
                  <p className="text-sm text-danger">{ratingError.message}</p>
                )}
                <Button
                  type="button"
                  isLoading={ratingSubmittingId === application.shift.id}
                  disabled={!ratingDrafts[application.shift.id]?.score}
                  onClick={() => handleRate(application.id, application.shift!.id)}
                >
                  Enviar avaliação
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
