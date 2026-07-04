import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ShiftResponse, toShiftResponse } from './shift-response';

export interface CheckOutInput {
  lat: number | undefined;
  lng: number | undefined;
}

/** UPDATE condicional (WHERE status = 'checked_in') fecha a corrida de dois check-outs simultâneos. */
export async function checkOut(
  workerId: string,
  shiftId: string,
  input: CheckOutInput,
): Promise<ShiftResponse> {
  if (typeof input.lat !== 'number' || input.lat < -90 || input.lat > 90) {
    throw new HttpError(400, 'Latitude inválida.');
  }
  if (typeof input.lng !== 'number' || input.lng < -180 || input.lng > 180) {
    throw new HttpError(400, 'Longitude inválida.');
  }

  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }
  if (shift.workerId !== workerId) {
    throw new HttpError(403, 'Você não tem acesso a esse turno.');
  }
  if (shift.status !== 'checked_in') {
    throw new HttpError(400, 'Esse turno não está esperando check-out.');
  }

  const [updated] = await db
    .update(shifts)
    .set({
      status: 'completed',
      checkOutAt: new Date(),
      checkOutLat: input.lat,
      checkOutLng: input.lng,
      updatedAt: new Date(),
    })
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'checked_in')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse turno não está esperando check-out.');
  }

  return toShiftResponse(updated);
}
