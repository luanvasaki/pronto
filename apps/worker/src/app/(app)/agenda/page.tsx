'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { MapLink } from '../../../components/ui/map-link';
import { getCurrentPosition } from '../../../lib/geolocation';
import { checkIn, checkOut, confirmPayment, listMyShifts, rateShift, Shift } from '../../../lib/shifts-api';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

const SHIFT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  checked_in: 'Em andamento',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  cancelled: 'Cancelado',
};

const SHIFT_STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-warning/10 text-warning',
  checked_in: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  no_show: 'bg-danger/10 text-danger',
  cancelled: 'bg-border text-text-secondary',
};

/**
 * Não existe cobrança pela plataforma (decisão de produto: pagamento é
 * acertado direto entre empresa e trabalhador) — os rótulos refletem
 * isso, mesmo que o campo por trás ainda seja `payment.status`.
 */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando conclusão do turno',
  charged: 'Turno concluído — acerte o pagamento direto com a empresa',
  released: 'A empresa marcou como pago — você recebeu?',
  confirmed: 'Você confirmou o recebimento',
  disputed: 'Você avisou que não recebeu — em análise',
  failed: 'Não foi possível registrar o acerto',
  refunded: 'Acerto cancelado',
};

const RATING_SCORES = [1, 2, 3, 4, 5];

interface RatingDraft {
  score: number;
  comment: string;
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(iso));
}

const REMINDER_WINDOW_HOURS = 24;
const REMINDER_URGENT_HOURS = 2;

interface UpcomingReminder {
  message: string;
  urgent: boolean;
}

/** Aviso pra não perder o turno confirmado — some depois que começa (o
 * trabalhador já deveria estar fazendo check-in, não esperando um lembrete). */
function getUpcomingReminder(startsAt: string): UpcomingReminder | null {
  const hoursUntil = (new Date(startsAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil <= 0 || hoursUntil > REMINDER_WINDOW_HOURS) return null;

  const urgent = hoursUntil <= REMINDER_URGENT_HOURS;
  const time = formatTime(startsAt);
  const minutesUntil = Math.round(hoursUntil * 60);
  const countdown =
    minutesUntil < 60
      ? `em ${minutesUntil} min`
      : `em ${Math.round(hoursUntil)}h`;
  const message = urgent
    ? `Seu turno começa ${countdown}, às ${time} — não perca o horário!`
    : `Seu turno começa ${countdown}, às ${time}. Não esqueça!`;

  return { message, urgent };
}

interface TimelineRowProps {
  label: string;
  time: string;
  done: boolean;
  active?: boolean;
  last?: boolean;
}

function TimelineRow({ label, time, done, active, last }: TimelineRowProps) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${
            done || active ? 'bg-success' : 'bg-border'
          }`}
        >
          {done && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {active && !done && <span className="h-2 w-2 rounded-full bg-surface" aria-hidden="true" />}
        </span>
        <div>
          <p className={`text-[15px] font-semibold ${done || active ? 'text-text' : 'text-text-secondary'}`}>
            {label}
          </p>
          <p className="text-[12.5px] text-text-secondary">{time}</p>
        </div>
      </div>
      {!last && <div className="ml-[13px] my-1 h-4 w-0.5 bg-border" />}
    </div>
  );
}

export default function TurnosPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actingShiftId, setActingShiftId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ shiftId: string; message: string } | null>(null);

  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [ratingSubmittingId, setRatingSubmittingId] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<{ shiftId: string; message: string } | null>(null);

  const [confirmingShiftId, setConfirmingShiftId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<{ shiftId: string; message: string } | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [shiftsResult, categoriesResult] = await Promise.all([listMyShifts(), listSkillCategories()]);
        setShifts(shiftsResult.shifts);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch {
        setError('Não foi possível carregar seus turnos.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleCheckIn(shiftId: string): Promise<void> {
    setActionError(null);
    setActingShiftId(shiftId);

    try {
      const position = await getCurrentPosition('Precisamos da sua localização para confirmar o check-in.');
      const updated = await checkIn(shiftId, position.coords.latitude, position.coords.longitude);
      setShifts((current) => current.map((shift) => (shift.id === shiftId ? { ...shift, ...updated } : shift)));
    } catch (err) {
      setActionError({
        shiftId,
        message: err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível fazer check-in.',
      });
    } finally {
      setActingShiftId(null);
    }
  }

  async function handleCheckOut(shiftId: string): Promise<void> {
    setActionError(null);
    setActingShiftId(shiftId);

    try {
      const position = await getCurrentPosition('Precisamos da sua localização para confirmar o check-out.');
      await checkOut(shiftId, position.coords.latitude, position.coords.longitude);
      // A resposta do check-out não traz `payment` (a cobrança é criada
      // logo depois, como efeito colateral) — busca a lista de novo em
      // vez de mesclar a resposta parcial, senão o status de pagamento
      // só aparece depois de um reload manual da página.
      const refreshed = await listMyShifts();
      setShifts(refreshed.shifts);
    } catch (err) {
      setActionError({
        shiftId,
        message: err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível fazer check-out.',
      });
    } finally {
      setActingShiftId(null);
    }
  }

  function setRatingScore(shiftId: string, score: number): void {
    setRatingDrafts((current) => ({ ...current, [shiftId]: { score, comment: current[shiftId]?.comment ?? '' } }));
  }

  function setRatingComment(shiftId: string, comment: string): void {
    setRatingDrafts((current) => ({ ...current, [shiftId]: { score: current[shiftId]?.score ?? 0, comment } }));
  }

  async function handleRate(shiftId: string): Promise<void> {
    const draft = ratingDrafts[shiftId];
    if (!draft?.score) return;

    setRatingError(null);
    setRatingSubmittingId(shiftId);

    try {
      const rating = await rateShift(shiftId, draft.score, draft.comment.trim() || undefined);
      setShifts((current) =>
        current.map((shift) =>
          shift.id === shiftId ? { ...shift, ratings: { ...shift.ratings, worker: rating } } : shift,
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

  async function handleConfirmPayment(shiftId: string, received: boolean): Promise<void> {
    setConfirmError(null);
    setConfirmingShiftId(shiftId);

    try {
      const payment = await confirmPayment(shiftId, received);
      setShifts((current) => current.map((shift) => (shift.id === shiftId ? { ...shift, payment } : shift)));
    } catch (err) {
      setConfirmError({
        shiftId,
        message:
          err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível registrar sua resposta.',
      });
    } finally {
      setConfirmingShiftId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando seus turnos...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Meus turnos</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {shifts.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não tem turnos agendados.</p>
      )}

      <ul className="flex flex-col gap-3">
        {shifts.map((shift) => {
          const step = shift.status === 'completed' ? 2 : shift.status === 'checked_in' ? 1 : 0;
          const showTimeline = ['scheduled', 'checked_in', 'completed'].includes(shift.status);
          const reminder = shift.status === 'scheduled' ? getUpcomingReminder(shift.job.startsAt) : null;

          return (
            <li
              key={shift.id}
              className="rounded-[20px] border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading text-[17px] font-bold text-text">
                  {categoryNames[shift.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                </p>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                    SHIFT_STATUS_CLASS[shift.status] ?? SHIFT_STATUS_CLASS.scheduled
                  }`}
                >
                  {SHIFT_STATUS_LABEL[shift.status] ?? shift.status}
                </span>
              </div>
              {reminder && (
                <p
                  className={`mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${
                    reminder.urgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                  }`}
                >
                  ⏰ {reminder.message}
                </p>
              )}
              <MapLink
                addressLabel={shift.job.addressLabel}
                lat={shift.job.locationLat}
                lng={shift.job.locationLng}
                className="mt-1 text-sm"
              />
              <p className="mt-1 text-sm text-text-secondary">
                {formatDateRange(shift.job.startsAt, shift.job.endsAt)}
              </p>
              <p className="mt-2 font-heading text-lg font-bold text-primary">R$ {shift.payAmountSnapshot}</p>

              {shift.payment && (
                <p
                  className={`mt-1 text-sm ${
                    shift.payment.status === 'disputed' ? 'text-danger' : 'text-text-secondary'
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[shift.payment.status] ?? shift.payment.status}
                </p>
              )}

              {shift.payment?.status === 'released' && (
                <div className="mt-2.5 flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    isLoading={confirmingShiftId === shift.id}
                    onClick={() => handleConfirmPayment(shift.id, true)}
                    className="flex-1"
                  >
                    Recebi o pagamento
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    isLoading={confirmingShiftId === shift.id}
                    onClick={() => handleConfirmPayment(shift.id, false)}
                    className="flex-1"
                  >
                    Não recebi
                  </Button>
                </div>
              )}

              {confirmError?.shiftId === shift.id && (
                <p className="mt-2 text-sm text-danger">{confirmError.message}</p>
              )}

              {showTimeline && (
                <div className="mt-3.5 rounded-[18px] border border-border bg-background p-4">
                  <TimelineRow
                    label="Check-in"
                    done={step >= 1}
                    time={shift.checkInAt ? formatTime(shift.checkInAt) : 'Aguardando'}
                  />
                  <TimelineRow
                    label="Em andamento"
                    done={step >= 2}
                    active={step === 1}
                    time={step === 1 ? 'Turno em andamento' : step === 2 ? 'Concluído' : '—'}
                  />
                  <TimelineRow
                    label="Check-out"
                    done={step >= 2}
                    last
                    time={shift.checkOutAt ? formatTime(shift.checkOutAt) : 'Ao fim do turno'}
                  />
                </div>
              )}

              {actionError?.shiftId === shift.id && (
                <p className="mt-2 text-sm text-danger">{actionError.message}</p>
              )}

              {shift.status === 'scheduled' && (
                <Button
                  type="button"
                  isLoading={actingShiftId === shift.id}
                  onClick={() => handleCheckIn(shift.id)}
                  className="mt-3.5 w-full"
                >
                  Fazer check-in
                </Button>
              )}

              {shift.status === 'checked_in' && (
                <Button
                  type="button"
                  isLoading={actingShiftId === shift.id}
                  onClick={() => handleCheckOut(shift.id)}
                  className="mt-3.5 w-full"
                >
                  Fazer check-out
                </Button>
              )}

              {shift.status === 'completed' && shift.ratings.worker && (
                <p className="mt-3.5 text-sm text-success">Você avaliou: {shift.ratings.worker.score} de 5.</p>
              )}

              {shift.status === 'completed' && !shift.ratings.worker && (
                <div className="mt-3.5 flex flex-col gap-3 rounded-[18px] border border-border p-4">
                  <p className="font-heading text-[15px] font-bold text-text">Avaliar a empresa</p>
                  <div className="flex gap-1.5" role="group" aria-label="Nota de 1 a 5">
                    {RATING_SCORES.map((score) => {
                      const selected = (ratingDrafts[shift.id]?.score ?? 0) >= score;
                      return (
                        <button
                          key={score}
                          type="button"
                          aria-label={`${score} de 5`}
                          aria-pressed={selected}
                          onClick={() => setRatingScore(shift.id, score)}
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
                    value={ratingDrafts[shift.id]?.comment ?? ''}
                    onChange={(event) => setRatingComment(shift.id, event.target.value)}
                    className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-3 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
                  />
                  {ratingError?.shiftId === shift.id && (
                    <p className="text-sm text-danger">{ratingError.message}</p>
                  )}
                  <Button
                    type="button"
                    isLoading={ratingSubmittingId === shift.id}
                    disabled={!ratingDrafts[shift.id]?.score}
                    onClick={() => handleRate(shift.id)}
                  >
                    Enviar avaliação
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
