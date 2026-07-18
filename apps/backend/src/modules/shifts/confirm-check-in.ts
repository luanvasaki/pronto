import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { HttpError } from '../../shared/errors/http-error';
import { ShiftResponse, toShiftResponse } from './shift-response';

/**
 * A empresa confirma que o trabalhador chegou — some do sino e vira uma
 * confirmação de verdade (não só "visto"). Não trava o check-out: por
 * isso aceita tanto 'checked_in' quanto 'checked_out' (o trabalhador pode
 * já ter saído antes da empresa confirmar a chegada).
 */
export async function confirmCheckIn(ownerUserId: string, shiftId: string): Promise<ShiftResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a esse turno.');

  if (shift.status !== 'checked_in' && shift.status !== 'checked_out') {
    throw new HttpError(400, 'Esse turno ainda não teve check-in.');
  }

  if (shift.checkInConfirmedAt) {
    return toShiftResponse(shift);
  }

  const [updated] = await db
    .update(shifts)
    .set({ checkInConfirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(shifts.id, shiftId))
    .returning();
  if (!updated) {
    throw new HttpError(500, 'Não foi possível confirmar o check-in.');
  }

  return toShiftResponse(updated);
}
