import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface UpdateWorkerLocationInput {
  lat: number | undefined;
  lng: number | undefined;
}

export interface WorkerLocationResult {
  homeLat: number;
  homeLng: number;
}

/**
 * Endpoint separado do upsert de perfil de propósito: se estivesse
 * junto, uma chamada que só atualiza nome/categorias (vinda da tela de
 * cadastro) apagaria a localização já salva ao não reenviar lat/lng.
 */
export async function updateWorkerLocation(
  userId: string,
  input: UpdateWorkerLocationInput,
): Promise<WorkerLocationResult> {
  const { lat, lng } = input;

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    throw new HttpError(400, 'Latitude inválida.');
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    throw new HttpError(400, 'Longitude inválida.');
  }

  const profile = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.userId, userId),
  });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de definir a localização.');
  }

  const [updated] = await db
    .update(workerProfiles)
    .set({ homeLat: lat, homeLng: lng, updatedAt: new Date() })
    .where(eq(workerProfiles.userId, userId))
    .returning();

  if (!updated || updated.homeLat === null || updated.homeLng === null) {
    throw new HttpError(500, 'Não foi possível salvar a localização.');
  }

  return { homeLat: updated.homeLat, homeLng: updated.homeLng };
}
