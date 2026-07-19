import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { HttpError } from '../../shared/errors/http-error';
import { ShiftResponse, toShiftResponse } from './shift-response';

/**
 * A empresa confirma que o trabalhador chegou — some do sino e vira uma
 * confirmação de verdade (não só "visto"). Não trava o check-out: por
 * isso aceita tanto 'checked_in' quanto 'checked_out' (o trabalhador pode
 * já ter saído antes da empresa confirmar a chegada). UPDATE condicional
 * (WHERE status IN (...) AND checkInConfirmedAt IS NULL) fecha a corrida
 * de duas confirmações simultâneas, mesmo padrão de check-in/check-out/
 * confirm-check-out.ts.
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

  const [updated] = await db
    .update(shifts)
    .set({ checkInConfirmedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(shifts.id, shiftId),
        inArray(shifts.status, ['checked_in', 'checked_out']),
        isNull(shifts.checkInConfirmedAt),
      ),
    )
    .returning();

  if (updated) {
    return toShiftResponse(updated);
  }

  // UPDATE não afetou nenhuma linha: ou já tinha sido confirmado antes
  // (idempotente, devolve o estado atual), ou o status mudou numa
  // corrida entre a leitura acima e o UPDATE.
  const current = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (current?.checkInConfirmedAt) {
    return toShiftResponse(current);
  }
  throw new HttpError(400, 'Esse turno ainda não teve check-in.');
}
