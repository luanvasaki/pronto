import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { HttpError } from '../../shared/errors/http-error';
import { ShiftResponse, toShiftResponse } from './shift-response';

/** A empresa confirma que viu o aviso de check-in (some do sino) — mesmo padrão de markApplicationSeen. */
export async function markShiftCheckInSeen(ownerUserId: string, shiftId: string): Promise<ShiftResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a esse turno.');

  if (shift.companySeenCheckInAt) {
    return toShiftResponse(shift);
  }

  const [updated] = await db
    .update(shifts)
    .set({ companySeenCheckInAt: new Date() })
    .where(eq(shifts.id, shiftId))
    .returning();
  if (!updated) {
    throw new HttpError(500, 'Não foi possível atualizar o turno.');
  }

  return toShiftResponse(updated);
}
