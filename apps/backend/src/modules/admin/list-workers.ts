import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { shifts, users, workerProfiles } from '../../db/schema';

export interface AdminWorker {
  userId: string;
  fullName: string;
  email: string | null;
  // Contato do trabalhador — só o admin vê essa lista (nunca exposto
  // pra empresa, ver comentário de worker_profiles.phone).
  phone: string | null;
  photoUrl: string | null;
  kycStatus: string;
  avgRating: string | null;
  shiftsCompleted: number;
  hoursWorked: number;
  createdAt: Date;
}

/**
 * Mesma expressão de horas de get-worker-profile.ts (extract(epoch from
 * checkOut - checkIn) / 3600), agrupada por trabalhador em vez de filtrada
 * por um só — já sai ordenado por quem mais trabalha.
 */
export async function listAdminWorkers(): Promise<AdminWorker[]> {
  const rows = await db
    .select({
      userId: workerProfiles.userId,
      fullName: workerProfiles.fullName,
      email: users.email,
      phone: workerProfiles.phone,
      photoUrl: workerProfiles.photoUrl,
      kycStatus: workerProfiles.kycStatus,
      avgRating: workerProfiles.avgRating,
      createdAt: workerProfiles.createdAt,
      shiftsCompleted: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
      hoursWorked: sql<string>`coalesce(sum(extract(epoch from (${shifts.checkOutAt} - ${shifts.checkInAt}))) filter (where ${shifts.status} = 'completed' and ${shifts.checkOutAt} is not null and ${shifts.checkInAt} is not null), 0) / 3600`,
    })
    .from(workerProfiles)
    .leftJoin(users, eq(users.id, workerProfiles.userId))
    .leftJoin(shifts, eq(shifts.workerId, workerProfiles.userId))
    .groupBy(workerProfiles.userId, users.email)
    .orderBy(desc(sql`count(*) filter (where ${shifts.status} = 'completed')`));

  return rows.map((row) => ({
    ...row,
    shiftsCompleted: Number(row.shiftsCompleted),
    hoursWorked: Math.round(Number(row.hoursWorked) * 10) / 10,
  }));
}
