'use client';

import { ApiError, COMPANY_RATING_CATEGORIES, listSkillCategories, rateShift } from '@shift/shared';
import { useEffect, useState } from 'react';
import { RatingForm, RatingSummary } from '../../../components/rating-form';
import { Button } from '../../../components/ui/button';
import { MapLink } from '../../../components/ui/map-link';
import { getCurrentPosition } from '../../../lib/geolocation';
import { checkIn, checkOut, confirmPayment, listMyShifts, Shift } from '../../../lib/shifts-api';

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
  pending: 'Aguardando conclusão da escala',
  charged: 'Escala concluída — acerte o pagamento direto com a empresa',
  released: 'A empresa marcou como pago — você recebeu?',
  confirmed: 'Você confirmou o recebimento',
  disputed: 'Você avisou que não recebeu — em análise',
  failed: 'Não foi possível registrar o acerto',
  refunded: 'Acerto cancelado',
};

/** Cor do ponto no calendário — mesmo mapeamento de SHIFT_STATUS_CLASS, mas sólido (dot, não pílula). */
const CALENDAR_DOT_CLASS: Record<string, string> = {
  scheduled: 'bg-warning',
  checked_in: 'bg-primary',
  completed: 'bg-success',
  no_show: 'bg-danger',
  cancelled: 'bg-border',
};

const WEEKDAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_DOTS_PER_DAY = 4;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCalendarGrid(monthDate: Date): Date {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatFullDate(iso: string): string {
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(
    new Date(iso),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface RatingDraft {
  scores: Record<string, number>;
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

/** Aviso pra não perder a escala confirmada — some depois que começa (o
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
    ? `Sua escala começa ${countdown}, às ${time} — não perca o horário!`
    : `Sua escala começa ${countdown}, às ${time}. Não esqueça!`;

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

export default function AgendaPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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
        setError('Não foi possível carregar suas escalas.');
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

  async function handleRate(shiftId: string): Promise<void> {
    const draft = ratingDrafts[shiftId];
    const isComplete = COMPANY_RATING_CATEGORIES.every((category) => Boolean(draft?.scores[category.id]));
    if (!draft || !isComplete) return;

    setRatingError(null);
    setRatingSubmittingId(shiftId);

    try {
      const rating = await rateShift(shiftId, draft.scores, draft.comment.trim() || undefined);
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
        <p className="text-sm text-text-secondary">Carregando suas escalas...</p>
      </main>
    );
  }

  const scheduledCount = shifts.filter((shift) => shift.status === 'scheduled' || shift.status === 'checked_in').length;
  const completedCount = shifts.filter((shift) => shift.status === 'completed').length;

  const shiftsByDateKey = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = toDateKey(new Date(shift.job.startsAt));
    const dayShifts = shiftsByDateKey.get(key) ?? [];
    dayShifts.push(shift);
    shiftsByDateKey.set(key, dayShifts);
  }

  const gridStart = startOfCalendarGrid(currentMonth);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const today = new Date();
  const selectedDayShifts = selectedDateKey ? (shiftsByDateKey.get(selectedDateKey) ?? []) : [];

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Minhas escalas</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {shifts.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não tem escalas agendadas.</p>
      )}

      {shifts.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl border border-border bg-surface p-4 text-center">
            <p className="font-heading text-xl font-bold text-warning">{scheduledCount}</p>
            <p className="mt-1 text-xs text-text-secondary">Agendadas</p>
          </div>
          <div className="flex-1 rounded-2xl border border-border bg-surface p-4 text-center">
            <p className="font-heading text-xl font-bold text-success">{completedCount}</p>
            <p className="mt-1 text-xs text-text-secondary">Já concluídas</p>
          </div>
        </div>
      )}

      {shifts.length > 0 && (
        <div className="rounded-[20px] border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-bold text-text">{monthLabel(currentMonth)}</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => {
                  setSelectedDateKey(null);
                  setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1));
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text transition hover:border-primary hover:text-primary"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDateKey(null);
                }}
                className="rounded-lg border border-border px-2 py-1 text-[12px] font-semibold text-text transition hover:border-primary hover:text-primary"
              >
                Hoje
              </button>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => {
                  setSelectedDateKey(null);
                  setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1));
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text transition hover:border-primary hover:text-primary"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-[0.06em] text-text-secondary uppercase">
            {WEEKDAY_LABEL.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((date) => {
              const dateKey = toDateKey(date);
              const dayShifts = shiftsByDateKey.get(dateKey) ?? [];
              const inCurrentMonth = date.getMonth() === currentMonth.getMonth();
              const isToday = isSameDate(date, today);
              const isSelected = dateKey === selectedDateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={dayShifts.length === 0}
                  onClick={() => setSelectedDateKey((current) => (current === dateKey ? null : dateKey))}
                  className={`flex min-h-[42px] flex-col items-center gap-1 rounded-lg py-1.5 ${
                    isSelected ? 'bg-primary/10' : dayShifts.length > 0 ? 'hover:bg-background' : ''
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11.5px] font-semibold ${
                      isToday
                        ? 'bg-primary text-white'
                        : inCurrentMonth
                          ? 'text-text'
                          : 'text-text-secondary/40'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <span className="flex h-[6px] items-center gap-[3px]">
                    {dayShifts.slice(0, MAX_DOTS_PER_DAY).map((shift) => (
                      <span
                        key={shift.id}
                        className={`h-[5px] w-[5px] rounded-full ${CALENDAR_DOT_CLASS[shift.status] ?? 'bg-border'}`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11.5px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-warning" /> Agendada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-primary" /> Em andamento
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-success" /> Concluída
            </span>
          </div>

          {selectedDateKey && selectedDayShifts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              {selectedDayShifts.map((shift) => (
                <li key={shift.id} className="rounded-xl bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-text">
                      {categoryNames[shift.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                    </p>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        SHIFT_STATUS_CLASS[shift.status] ?? SHIFT_STATUS_CLASS.scheduled
                      }`}
                    >
                      {SHIFT_STATUS_LABEL[shift.status] ?? shift.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-text-secondary">{shift.companyName}</p>
                  <p className="mt-1 text-[12.5px] text-text-secondary">
                    {formatFullDate(shift.job.startsAt)} · {formatTime(shift.job.startsAt)}–
                    {formatTime(shift.job.endsAt)}
                  </p>
                  <MapLink
                    addressLabel={shift.job.addressLabel}
                    lat={shift.job.locationLat}
                    lng={shift.job.locationLng}
                    className="mt-1 text-[12.5px]"
                  />
                  {shift.job.dressCode && (
                    <p className="mt-1 text-[12.5px] text-text-secondary">
                      <span className="font-semibold text-text">Vestimenta:</span> {shift.job.dressCode}
                    </p>
                  )}
                  {shift.job.toolsRequired && (
                    <p className="mt-1 text-[12.5px] text-text-secondary">
                      <span className="font-semibold text-text">Leve com você:</span> {shift.job.toolsRequired}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
                <div>
                  <p className="font-heading text-[17px] font-bold text-text">
                    {categoryNames[shift.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                  </p>
                  <p className="text-[13px] font-semibold text-text-secondary">{shift.companyName}</p>
                </div>
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
                    time={step === 1 ? 'Escala em andamento' : step === 2 ? 'Concluído' : '—'}
                  />
                  <TimelineRow
                    label="Check-out"
                    done={step >= 2}
                    last
                    time={shift.checkOutAt ? formatTime(shift.checkOutAt) : 'Ao fim da escala'}
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
                <RatingSummary rating={shift.ratings.worker} categories={COMPANY_RATING_CATEGORIES} />
              )}

              {shift.status === 'completed' && !shift.ratings.worker && (
                <RatingForm
                  title="Avaliar a empresa"
                  categories={COMPANY_RATING_CATEGORIES}
                  scores={ratingDrafts[shift.id]?.scores ?? {}}
                  comment={ratingDrafts[shift.id]?.comment ?? ''}
                  onChangeScore={(categoryId, score) => setRatingScore(shift.id, categoryId, score)}
                  onChangeComment={(comment) => setRatingComment(shift.id, comment)}
                  onSubmit={() => handleRate(shift.id)}
                  isSubmitting={ratingSubmittingId === shift.id}
                  error={ratingError?.shiftId === shift.id ? ratingError.message : undefined}
                />
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
