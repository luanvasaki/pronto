import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { documents, shifts, workerProfiles, workerSkills } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface WorkerProfileDetails {
  fullName: string;
  bio: string | null;
  cpf: string | null;
  categoryIds: string[];
  experienceByCategory: Record<string, boolean>;
  photoUrl: string | null;
  homeAddressLabel: string | null;
  kycStatus: string;
  hasDocument: boolean;
  avgRating: string | null;
  totalShiftsCompleted: number;
  totalHoursWorked: number;
}

export async function getWorkerProfile(userId: string): Promise<WorkerProfileDetails> {
  const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, userId) });
  if (!profile) {
    throw new HttpError(404, 'Complete seu cadastro antes de ver o perfil.');
  }

  const skills = await db.query.workerSkills.findMany({ where: eq(workerSkills.workerId, userId) });
  const document = await db.query.documents.findFirst({ where: eq(documents.workerId, userId) });

  // "Horas de voo": calculadas ao vivo a partir dos turnos concluídos —
  // as colunas `totalShiftsCompleted`/`totalNoShows` de `worker_profiles`
  // nunca são atualizadas por nenhum código, então não são confiáveis.
  const [stats] = await db
    .select({
      totalShiftsCompleted: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
      totalHoursWorked: sql<string>`coalesce(sum(extract(epoch from (${shifts.checkOutAt} - ${shifts.checkInAt}))) filter (where ${shifts.status} = 'completed' and ${shifts.checkOutAt} is not null and ${shifts.checkInAt} is not null), 0) / 3600`,
    })
    .from(shifts)
    .where(eq(shifts.workerId, userId));

  return {
    fullName: profile.fullName,
    bio: profile.bio,
    cpf: profile.cpf,
    categoryIds: skills.map((skill) => skill.categoryId),
    experienceByCategory: Object.fromEntries(skills.map((skill) => [skill.categoryId, skill.hasExperience])),
    photoUrl: profile.photoUrl,
    homeAddressLabel: profile.homeAddressLabel,
    kycStatus: profile.kycStatus,
    hasDocument: Boolean(document),
    avgRating: profile.avgRating,
    totalShiftsCompleted: Number(stats?.totalShiftsCompleted ?? 0),
    totalHoursWorked: Math.round(Number(stats?.totalHoursWorked ?? 0) * 10) / 10,
  };
}
