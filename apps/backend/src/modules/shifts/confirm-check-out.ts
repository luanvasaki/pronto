import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { chargeForShift } from '../payments/charge-for-shift';
import { PaymentGateway } from '../payments/payment-gateway';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { HttpError } from '../../shared/errors/http-error';
import { ShiftResponse, toShiftResponse } from './shift-response';

/**
 * A empresa confirma que o turno realmente aconteceu como esperado — é
 * esse ato, não o check-out do trabalhador, que fecha o turno
 * ('checked_out' -> 'completed') e dispara a cobrança. UPDATE condicional
 * (WHERE status = 'checked_out') fecha a corrida de duas confirmações
 * simultâneas, mesmo padrão de check-in/check-out.
 */
export async function confirmCheckOut(
  gateway: PaymentGateway,
  ownerUserId: string,
  shiftId: string,
): Promise<ShiftResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a esse turno.');

  if (shift.status !== 'checked_out') {
    throw new HttpError(400, 'Esse turno não está esperando confirmação de check-out.');
  }

  const [updated] = await db
    .update(shifts)
    .set({ status: 'completed', checkOutConfirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'checked_out')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse turno não está esperando confirmação de check-out.');
  }

  // Best-effort: a confirmação já aconteceu, uma falha ao criar a
  // cobrança não deveria impedir a resposta de sucesso (mesmo padrão de
  // check-out.controller.ts antes dessa mudança).
  try {
    await chargeForShift(gateway, updated.id, updated.payAmountSnapshot);
  } catch (paymentError) {
    console.error('Falha ao criar cobrança do turno', paymentError);
  }

  return toShiftResponse(updated);
}
