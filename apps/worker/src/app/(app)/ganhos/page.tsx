'use client';

import { useEffect, useState } from 'react';
import { listMyShifts, Shift } from '../../../lib/shifts-api';

/**
 * Pagamento *processado pela plataforma* foi adiado pra fase 2 (ver
 * create-payment-gateway.ts no backend) — empresa e trabalhador acertam o
 * pagamento direto ao concluir a escala. Isso não impede mostrar o
 * histórico do que já foi ganho: montamos o resumo abaixo só com o que
 * `listMyShifts()` já retorna, sem precisar de nenhuma cobrança real.
 */

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Mesmos rótulos usados em /agenda pra status de pagamento — reaproveitados
 * aqui, mais curtos, só como indicativo de "já confirmado" vs "ainda não". */
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando conclusão',
  charged: 'Acerte direto com a empresa',
  released: 'Empresa marcou como pago',
  confirmed: 'Recebimento confirmado',
  disputed: 'Em análise',
  failed: 'Acerto não registrado',
  refunded: 'Acerto cancelado',
};

function monthKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

interface MonthGroup {
  key: string;
  label: string;
  total: number;
  shifts: Shift[];
}

function groupByMonth(shifts: Shift[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();

  for (const shift of shifts) {
    const key = monthKey(shift.job.startsAt);
    const group = groups.get(key) ?? { key, label: monthLabel(shift.job.startsAt), total: 0, shifts: [] };
    group.total += Number(shift.payAmountSnapshot);
    group.shifts.push(shift);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .map((group) => ({
      ...group,
      shifts: group.shifts.sort((a, b) => (a.job.startsAt < b.job.startsAt ? 1 : -1)),
    }));
}

export default function GanhosPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const result = await listMyShifts();
        setShifts(result.shifts);
      } catch {
        setError('Não foi possível carregar seus ganhos.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando seus ganhos...</p>
      </main>
    );
  }

  const completedShifts = shifts.filter((shift) => shift.status === 'completed');
  const monthGroups = groupByMonth(completedShifts);

  const currentMonthKey = monthKey(new Date().toISOString());
  const currentMonthGroup = monthGroups.find((group) => group.key === currentMonthKey);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="font-heading text-2xl font-bold text-text">Ganhos</h1>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-xs font-semibold tracking-[0.06em] text-text-secondary uppercase">Este mês</p>
        <p className="mt-1 font-heading text-3xl font-bold text-primary">
          {currentMonthGroup ? CURRENCY_FORMATTER.format(currentMonthGroup.total) : 'Nenhum ganho registrado ainda'}
        </p>
      </div>

      {monthGroups.length === 0 && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-heading text-lg font-bold text-text">Nenhum ganho ainda</p>
          <p className="max-w-xs text-sm text-text-secondary">
            Enquanto isso, combine o pagamento direto com a empresa ao concluir cada escala.
          </p>
        </div>
      )}

      {monthGroups.length > 0 && (
        <p className="text-sm text-text-secondary">
          Esse histórico é só um resumo do que você já ganhou — o pagamento de cada escala ainda é combinado
          direto com a empresa, a plataforma não processa isso por enquanto.
        </p>
      )}

      {monthGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          {monthGroups.map((group) => (
            <div key={group.key} className="rounded-[20px] border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-[15px] font-bold text-text">{group.label}</h2>
                <p className="font-heading text-[15px] font-bold text-primary">{CURRENCY_FORMATTER.format(group.total)}</p>
              </div>

              <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                {group.shifts.map((shift) => (
                  <li key={shift.id} className="rounded-xl bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13.5px] font-semibold text-text">{shift.companyName}</p>
                        <p className="mt-0.5 text-[12.5px] text-text-secondary">{formatDate(shift.job.startsAt)}</p>
                      </div>
                      <p className="whitespace-nowrap font-heading text-[15px] font-bold text-text">
                        {CURRENCY_FORMATTER.format(Number(shift.payAmountSnapshot))}
                      </p>
                    </div>
                    {shift.payment && (
                      <p className="mt-1 text-[11.5px] text-text-secondary">
                        {PAYMENT_STATUS_LABEL[shift.payment.status] ?? shift.payment.status}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
