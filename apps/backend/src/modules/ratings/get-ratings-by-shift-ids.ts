import { inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { ratings } from '../../db/schema';
import { RatingResponse, toRatingResponse } from './rating-response';

export interface ShiftRatings {
  worker: RatingResponse | null;
  company: RatingResponse | null;
}

/** Usado por list-my-shifts e list-job-applications pra embutir as avaliações de cada turno sem round-trip extra. */
export async function getRatingsByShiftIds(shiftIds: string[]): Promise<Map<string, ShiftRatings>> {
  const map = new Map<string, ShiftRatings>();
  if (shiftIds.length === 0) return map;

  const rows = await db.query.ratings.findMany({ where: inArray(ratings.shiftId, shiftIds) });
  for (const row of rows) {
    const entry = map.get(row.shiftId) ?? { worker: null, company: null };
    entry[row.raterRole] = toRatingResponse(row);
    map.set(row.shiftId, entry);
  }

  return map;
}
