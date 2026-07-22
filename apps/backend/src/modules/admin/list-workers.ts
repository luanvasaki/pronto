import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { loginConsents, shifts, users, workerProfiles } from '../../db/schema';

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
  // Prova de aceite pra eventual disputa jurídica (seção 12.5 do termo
  // consolidado) — ver docs/05-operations/auth-and-security.md.
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  termsIpAddress: string | null;
  loginTermsAcceptedAt: Date | null;
  loginTermsVersion: string | null;
  loginTermsIpAddress: string | null;
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
      termsAcceptedAt: users.termsAcceptedAt,
      termsVersion: users.termsVersion,
      termsIpAddress: users.termsIpAddress,
      shiftsCompleted: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
      hoursWorked: sql<string>`coalesce(sum(extract(epoch from (${shifts.checkOutAt} - ${shifts.checkInAt}))) filter (where ${shifts.status} = 'completed' and ${shifts.checkOutAt} is not null and ${shifts.checkInAt} is not null), 0) / 3600`,
    })
    .from(workerProfiles)
    .leftJoin(users, eq(users.id, workerProfiles.userId))
    .leftJoin(shifts, eq(shifts.workerId, workerProfiles.userId))
    .groupBy(workerProfiles.userId, users.email, users.termsAcceptedAt, users.termsVersion, users.termsIpAddress)
    .orderBy(desc(sql`count(*) filter (where ${shifts.status} = 'completed')`));

  const userIds = rows.map((row) => row.userId);
  const latestLoginConsents =
    userIds.length === 0
      ? []
      : await db
          .select({
            userId: loginConsents.userId,
            version: loginConsents.version,
            acceptedAt: loginConsents.acceptedAt,
            ipAddress: loginConsents.ipAddress,
          })
          .from(loginConsents)
          .where(inArray(loginConsents.userId, userIds))
          .orderBy(desc(loginConsents.acceptedAt));

  const latestLoginConsentByUserId = new Map<string, (typeof latestLoginConsents)[number]>();
  for (const consent of latestLoginConsents) {
    if (!latestLoginConsentByUserId.has(consent.userId)) latestLoginConsentByUserId.set(consent.userId, consent);
  }

  return rows.map((row) => {
    const loginConsent = latestLoginConsentByUserId.get(row.userId);
    return {
      ...row,
      shiftsCompleted: Number(row.shiftsCompleted),
      hoursWorked: Math.round(Number(row.hoursWorked) * 10) / 10,
      loginTermsAcceptedAt: loginConsent?.acceptedAt ?? null,
      loginTermsVersion: loginConsent?.version ?? null,
      loginTermsIpAddress: loginConsent?.ipAddress ?? null,
    };
  });
}
