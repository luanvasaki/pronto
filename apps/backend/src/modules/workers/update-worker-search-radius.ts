import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface UpdateSearchRadiusResult {
  searchRadiusKm: number;
}

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 100;

/**
 * Endpoint separado de update-worker-location.ts de propósito: mudar
 * o raio não deveria exigir pedir permissão de GPS de novo — só quem
 * já tem localização definida usa isso (list-nearby-jobs.ts já barra
 * quem não tem, então não precisa checar de novo aqui).
 */
export async function updateWorkerSearchRadius(
  userId: string,
  searchRadiusKm: number | undefined,
): Promise<UpdateSearchRadiusResult> {
  if (
    typeof searchRadiusKm !== 'number' ||
    !Number.isInteger(searchRadiusKm) ||
    searchRadiusKm < MIN_RADIUS_KM ||
    searchRadiusKm > MAX_RADIUS_KM
  ) {
    throw new HttpError(400, `Raio de busca precisa ser um número inteiro entre ${MIN_RADIUS_KM} e ${MAX_RADIUS_KM} km.`);
  }

  const [updated] = await db
    .update(workerProfiles)
    .set({ searchRadiusKm, updatedAt: new Date() })
    .where(eq(workerProfiles.userId, userId))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Complete seu cadastro antes de ajustar o raio de busca.');
  }

  return { searchRadiusKm: updated.searchRadiusKm };
}
