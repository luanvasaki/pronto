'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { getCurrentPosition } from '../../lib/geolocation';
import { checkIn, checkOut, listMyShifts, Shift } from '../../lib/shifts-api';

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

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

export default function TurnosPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actingShiftId, setActingShiftId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ shiftId: string; message: string } | null>(null);

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
      const updated = await checkOut(shiftId, position.coords.latitude, position.coords.longitude);
      setShifts((current) => current.map((shift) => (shift.id === shiftId ? { ...shift, ...updated } : shift)));
    } catch (err) {
      setActionError({
        shiftId,
        message: err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível fazer check-out.',
      });
    } finally {
      setActingShiftId(null);
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
    <main className="flex flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Meus turnos</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      {shifts.length === 0 && !error && (
        <p className="text-sm text-text-secondary">Você ainda não tem turnos agendados.</p>
      )}

      <ul className="flex flex-col gap-3">
        {shifts.map((shift) => (
          <li key={shift.id} className="rounded-md border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-text">
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
            <p className="mt-1 text-sm text-text-secondary">{shift.job.addressLabel}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {formatDateRange(shift.job.startsAt, shift.job.endsAt)}
            </p>
            <p className="mt-2 font-mono text-sm font-semibold text-text">R$ {shift.payAmountSnapshot}</p>

            {actionError?.shiftId === shift.id && (
              <p className="mt-2 text-sm text-danger">{actionError.message}</p>
            )}

            {shift.status === 'scheduled' && (
              <Button
                type="button"
                isLoading={actingShiftId === shift.id}
                onClick={() => handleCheckIn(shift.id)}
                className="mt-3 w-full"
              >
                Fazer check-in
              </Button>
            )}

            {shift.status === 'checked_in' && (
              <Button
                type="button"
                isLoading={actingShiftId === shift.id}
                onClick={() => handleCheckOut(shift.id)}
                className="mt-3 w-full"
              >
                Fazer check-out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
