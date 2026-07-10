import { inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { ratings } from '../../db/schema';
import { RatingResponse, toRatingResponse } from './rating-response';
import { isRatingRevealed } from './rating-visibility';

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

/**
 * Avaliação às cegas: quem chama sempre vê a própria nota que deu
 * (`ratings[viewerRole]`); a nota do outro lado só aparece se já revelada
 * (ver rating-visibility.ts) — senão vira `null`, mesmo que já exista no
 * banco. Aplicado em list-my-shifts.ts (viewerRole 'worker') e
 * list-job-applications.ts (viewerRole 'company').
 */
export function applyRatingVisibility(
  shiftRatings: ShiftRatings,
  checkOutAt: Date | null,
  viewerRole: 'worker' | 'company',
): ShiftRatings {
  const otherRole = viewerRole === 'worker' ? 'company' : 'worker';
  const revealed = isRatingRevealed(shiftRatings[viewerRole] !== null, checkOutAt);
  return {
    ...shiftRatings,
    [otherRole]: revealed ? shiftRatings[otherRole] : null,
  };
}
