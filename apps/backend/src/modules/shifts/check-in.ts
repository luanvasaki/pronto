import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ShiftResponse, toShiftResponse } from './shift-response';

export interface CheckInInput {
  lat: number | undefined;
  lng: number | undefined;
}

/** UPDATE condicional (WHERE status = 'scheduled') fecha a corrida de dois check-ins simultâneos. */
export async function checkIn(
  workerId: string,
  shiftId: string,
  input: CheckInInput,
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
  if (shift.status !== 'scheduled') {
    throw new HttpError(400, 'Esse turno não está esperando check-in.');
  }

  const [updated] = await db
    .update(shifts)
    .set({
      status: 'checked_in',
      checkInAt: new Date(),
      checkInLat: input.lat,
      checkInLng: input.lng,
      updatedAt: new Date(),
    })
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'scheduled')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse turno não está esperando check-in.');
  }

  return toShiftResponse(updated);
}
