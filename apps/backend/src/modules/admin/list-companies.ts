import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts, users } from '../../db/schema';

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
      jobsPosted: sql<string>`count(distinct ${jobs.id})`,
      shiftsCompleted: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
    })
    .from(companies)
    .leftJoin(users, eq(users.id, companies.ownerUserId))
    .leftJoin(jobs, eq(jobs.companyId, companies.id))
    .leftJoin(shifts, eq(shifts.jobId, jobs.id))
    .groupBy(companies.id, users.email)
    .orderBy(desc(sql`count(*) filter (where ${shifts.status} = 'completed')`));

  return rows.map((row) => ({
    ...row,
    jobsPosted: Number(row.jobsPosted),
    shiftsCompleted: Number(row.shiftsCompleted),
  }));
}
