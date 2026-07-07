import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { workerProfiles, workerSkills } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface WorkerProfileDetails {
  fullName: string;
  categoryIds: string[];
  photoUrl: string | null;
  homeAddressLabel: string | null;
  kycStatus: string;
  avgRating: string | null;
  totalShiftsCompleted: number;
  totalNoShows: number;
}

export async function getWorkerProfile(userId: string): Promise<WorkerProfileDetails> {
  const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, userId) });
  if (!profile) {
    throw new HttpError(404, 'Complete seu cadastro antes de ver o perfil.');
  }

  const skills = await db.query.workerSkills.findMany({ where: eq(workerSkills.workerId, userId) });

  return {
    fullName: profile.fullName,
    categoryIds: skills.map((skill) => skill.categoryId),
    photoUrl: profile.photoUrl,
    homeAddressLabel: profile.homeAddressLabel,
    kycStatus: profile.kycStatus,
    avgRating: profile.avgRating,
    totalShiftsCompleted: profile.totalShiftsCompleted,
    totalNoShows: profile.totalNoShows,
  };
}
