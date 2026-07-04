import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, workerProfiles, workerSkills } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { haversineDistanceKm } from './haversine';
import { JobResponse, toJobResponse } from './job-response';

export interface NearbyJobResponse extends JobResponse {
  distanceKm: number;
}

/**
 * Busca em memória (sem PostGIS): volume de vagas do MVP é pequeno
 * (uma cidade, poucas categorias), então filtrar por categoria no
 * banco e calcular distância em JS é simples e rápido o suficiente.
 * Revisar quando o volume justificar uma busca geoespacial no banco.
 */
export async function listNearbyJobs(workerId: string): Promise<NearbyJobResponse[]> {
  const profile = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.userId, workerId),
  });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de ver vagas.');
  }
  if (profile.homeLat === null || profile.homeLng === null) {
    throw new HttpError(400, 'Defina sua localização antes de ver vagas.');
  }

  const skills = await db.query.workerSkills.findMany({ where: eq(workerSkills.workerId, workerId) });
  const categoryIds = skills.map((skill) => skill.categoryId);
  if (categoryIds.length === 0) {
    return [];
  }

  const openJobs = await db.query.jobs.findMany({
    where: and(eq(jobs.status, 'open'), inArray(jobs.categoryId, categoryIds)),
  });

  const homeLat = profile.homeLat;
  const homeLng = profile.homeLng;

  return openJobs
    .filter((job) => job.positionsFilled < job.positionsTotal)
    .map((job) => ({
      job,
      distanceKm: haversineDistanceKm(homeLat, homeLng, job.locationLat, job.locationLng),
    }))
    .filter(({ distanceKm }) => distanceKm <= profile.searchRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map(({ job, distanceKm }) => ({
      ...toJobResponse(job),
      distanceKm: Math.round(distanceKm * 10) / 10,
    }));
}
