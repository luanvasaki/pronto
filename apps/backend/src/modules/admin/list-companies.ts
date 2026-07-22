import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, loginConsents, shifts, users } from '../../db/schema';

export interface AdminCompanyMinorsTermsJob {
  jobId: string;
  description: string;
  minorsTermsAcceptedAt: Date;
  minorsTermsVersion: string | null;
  minorsTermsIpAddress: string | null;
}

export interface AdminCompany {
  id: string;
  legalName: string;
  tradeName: string;
  personType: string;
  cnpj: string | null;
  cpf: string | null;
  logoUrl: string | null;
  verificationStatus: string;
  avgRating: string | null;
  ownerUserId: string;
  ownerEmail: string | null;
  jobsPosted: number;
  shiftsCompleted: number;
  createdAt: Date;
  // Prova de aceite pra eventual disputa jurídica (seção 12.5 do termo
  // consolidado) — ver docs/05-operations/auth-and-security.md.
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  termsIpAddress: string | null;
  loginTermsAcceptedAt: Date | null;
  loginTermsVersion: string | null;
  loginTermsIpAddress: string | null;
  minorsTermsJobs: AdminCompanyMinorsTermsJob[];
}

/**
 * Conta `jobs`/`shifts` ao vivo (mesmo padrão de get-metrics.ts) — nunca
 * uma coluna acumulada em `companies`. Aqui contamos por empresa via
 * LEFT JOIN até `shifts` (turno concluído = contratação de verdade, não
 * só vaga publicada) pra já sair ordenado por quem mais contrata.
 */
export async function listAdminCompanies(): Promise<AdminCompany[]> {
  const rows = await db
    .select({
      id: companies.id,
      legalName: companies.legalName,
      tradeName: companies.tradeName,
      personType: companies.personType,
      cnpj: companies.cnpj,
      cpf: companies.cpf,
      logoUrl: companies.logoUrl,
      verificationStatus: companies.verificationStatus,
      avgRating: companies.avgRating,
      ownerUserId: companies.ownerUserId,
      ownerEmail: users.email,
      createdAt: companies.createdAt,
      termsAcceptedAt: users.termsAcceptedAt,
      termsVersion: users.termsVersion,
      termsIpAddress: users.termsIpAddress,
      jobsPosted: sql<string>`count(distinct ${jobs.id})`,
      shiftsCompleted: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
    })
    .from(companies)
    .leftJoin(users, eq(users.id, companies.ownerUserId))
    .leftJoin(jobs, eq(jobs.companyId, companies.id))
    .leftJoin(shifts, eq(shifts.jobId, jobs.id))
    .groupBy(companies.id, users.email, users.termsAcceptedAt, users.termsVersion, users.termsIpAddress)
    .orderBy(desc(sql`count(*) filter (where ${shifts.status} = 'completed')`));

  const ownerUserIds = rows.map((row) => row.ownerUserId);
  const companyIds = rows.map((row) => row.id);

  const [latestLoginConsents, minorsTermsRows] = await Promise.all([
    ownerUserIds.length === 0
      ? []
      : db
          .select({
            userId: loginConsents.userId,
            version: loginConsents.version,
            acceptedAt: loginConsents.acceptedAt,
            ipAddress: loginConsents.ipAddress,
          })
          .from(loginConsents)
          .where(inArray(loginConsents.userId, ownerUserIds))
          .orderBy(desc(loginConsents.acceptedAt)),
    companyIds.length === 0
      ? []
      : db
          .select({
            companyId: jobs.companyId,
            jobId: jobs.id,
            description: jobs.description,
            minorsTermsAcceptedAt: jobs.minorsTermsAcceptedAt,
            minorsTermsVersion: jobs.minorsTermsVersion,
            minorsTermsIpAddress: jobs.minorsTermsIpAddress,
          })
          .from(jobs)
          .where(and(inArray(jobs.companyId, companyIds), isNotNull(jobs.minorsTermsAcceptedAt))),
  ]);

  const latestLoginConsentByUserId = new Map<string, (typeof latestLoginConsents)[number]>();
  for (const consent of latestLoginConsents) {
    if (!latestLoginConsentByUserId.has(consent.userId)) latestLoginConsentByUserId.set(consent.userId, consent);
  }

  const minorsTermsJobsByCompanyId = new Map<string, AdminCompanyMinorsTermsJob[]>();
  for (const row of minorsTermsRows) {
    if (!row.minorsTermsAcceptedAt) continue;
    const list = minorsTermsJobsByCompanyId.get(row.companyId) ?? [];
    list.push({
      jobId: row.jobId,
      description: row.description,
      minorsTermsAcceptedAt: row.minorsTermsAcceptedAt,
      minorsTermsVersion: row.minorsTermsVersion,
      minorsTermsIpAddress: row.minorsTermsIpAddress,
    });
    minorsTermsJobsByCompanyId.set(row.companyId, list);
  }

  return rows.map((row) => {
    const loginConsent = latestLoginConsentByUserId.get(row.ownerUserId);
    return {
      ...row,
      jobsPosted: Number(row.jobsPosted),
      shiftsCompleted: Number(row.shiftsCompleted),
      loginTermsAcceptedAt: loginConsent?.acceptedAt ?? null,
      loginTermsVersion: loginConsent?.version ?? null,
      loginTermsIpAddress: loginConsent?.ipAddress ?? null,
      minorsTermsJobs: minorsTermsJobsByCompanyId.get(row.id) ?? [],
    };
  });
}
