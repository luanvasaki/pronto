import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, workerProfiles, workerSkills } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { areApplicationsClosed } from './applications-close';
import { haversineDistanceKm } from './haversine';
import { JobResponse, toJobResponse } from './job-response';

export interface NearbyJobResponse extends JobResponse {
  distanceKm: number;
  companyName: string;
  companyLogoUrl: string | null;
  companyAvgRating: string | null;
  companyAvgCategoryScores: Record<string, string> | null;
  /** Trabalhador não tem essa categoria no perfil — mostra aviso, mas não impede candidatura. */
  matchesSkills: boolean;
  /** Vaga exige experiência anterior e o trabalhador não declarou ter nessa categoria. */
  experienceMismatch: boolean;
}

/**
 * Busca em memória (sem PostGIS): volume de vagas do MVP é pequeno
 * (uma cidade, poucas categorias), então filtrar por categoria no
 * banco e calcular distância em JS é simples e rápido o suficiente.
 * Revisar quando o volume justificar uma busca geoespacial no banco.
 *
 * Mostra vagas de QUALQUER categoria (não só as do perfil do
 * trabalhador) — `matchesSkills` avisa quando ele não tem a
 * especialidade, mas a decisão de se candidatar é dele.
 *
 * Some da lista assim que o prazo de candidatura passa (ver
 * applications-close.ts) — como esse prazo nunca é depois de
 * startsAt, isso também cobre o caso de a vaga já ter começado.
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
  const categoryIds = new Set(skills.map((skill) => skill.categoryId));
  const hasExperienceByCategoryId = new Map(skills.map((skill) => [skill.categoryId, skill.hasExperience]));

  const openJobs = await db.query.jobs.findMany({ where: eq(jobs.status, 'open') });

  const companyIds = [...new Set(openJobs.map((job) => job.companyId))];
  const companyRows =
    companyIds.length > 0 ? await db.query.companies.findMany({ where: inArray(companies.id, companyIds) }) : [];
  const companiesById = new Map(companyRows.map((company) => [company.id, company]));

  const homeLat = profile.homeLat;
  const homeLng = profile.homeLng;

  return openJobs
    .filter((job) => job.positionsFilled < job.positionsTotal)
    .filter((job) => !areApplicationsClosed(job))
    .map((job) => ({
      job,
      distanceKm: haversineDistanceKm(homeLat, homeLng, job.locationLat, job.locationLng),
    }))
    .filter(({ distanceKm }) => distanceKm <= profile.searchRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .flatMap(({ job, distanceKm }) => {
      const company = companiesById.get(job.companyId);
      if (!company) return [];
      return [
        {
          ...toJobResponse(job),
          distanceKm: Math.round(distanceKm * 10) / 10,
          companyName: company.tradeName,
          companyLogoUrl: company.logoUrl,
          companyAvgRating: company.avgRating,
          companyAvgCategoryScores: company.avgCategoryScores ?? null,
          matchesSkills: categoryIds.has(job.categoryId),
          experienceMismatch: job.requiresExperience && !(hasExperienceByCategoryId.get(job.categoryId) ?? false),
        },
      ];
    });
}
