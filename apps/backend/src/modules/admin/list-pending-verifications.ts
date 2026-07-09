import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, documents, skillCategories, workerProfiles } from '../../db/schema';

export interface PendingDocument {
  id: string;
  workerId: string;
  workerFullName: string;
  createdAt: Date;
}

export interface PendingCompany {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
}

export interface PendingSkillCategory {
  id: string;
  name: string;
  createdByName: string | null;
}

export interface PendingVerifications {
  documents: PendingDocument[];
  companies: PendingCompany[];
  skillCategories: PendingSkillCategory[];
}

/** Junta em memória (sem relations() configurado no Drizzle) — mesmo padrão de list-my-shifts. */
export async function listPendingVerifications(): Promise<PendingVerifications> {
  const pendingDocuments = await db.query.documents.findMany({ where: eq(documents.status, 'pending') });
  const workerIds = pendingDocuments.map((document) => document.workerId);
  const workers =
    workerIds.length > 0
      ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) })
      : [];
  const workersById = new Map(workers.map((worker) => [worker.userId, worker]));

  const pendingCompanies = await db.query.companies.findMany({
    where: eq(companies.verificationStatus, 'pending'),
  });

  const pendingSkillCategories = await db.query.skillCategories.findMany({
    where: eq(skillCategories.status, 'pending'),
  });
  const creatorCompanyIds = pendingSkillCategories.flatMap((category) =>
    category.createdByCompanyId ? [category.createdByCompanyId] : [],
  );
  const creatorCompanies =
    creatorCompanyIds.length > 0
      ? await db.query.companies.findMany({ where: inArray(companies.id, creatorCompanyIds) })
      : [];
  const creatorCompaniesById = new Map(creatorCompanies.map((company) => [company.id, company]));

  const creatorWorkerIds = pendingSkillCategories.flatMap((category) =>
    category.createdByWorkerId ? [category.createdByWorkerId] : [],
  );
  const creatorWorkers =
    creatorWorkerIds.length > 0
      ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, creatorWorkerIds) })
      : [];
  const creatorWorkersById = new Map(creatorWorkers.map((worker) => [worker.userId, worker]));

  return {
    documents: pendingDocuments.flatMap((document) => {
      const worker = workersById.get(document.workerId);
      if (!worker) return [];
      return [
        {
          id: document.id,
          workerId: document.workerId,
          workerFullName: worker.fullName,
          createdAt: document.createdAt,
        },
      ];
    }),
    companies: pendingCompanies.map((company) => ({
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      cnpj: company.cnpj,
    })),
    skillCategories: pendingSkillCategories.map((category) => {
      const createdByName = category.createdByCompanyId
        ? (creatorCompaniesById.get(category.createdByCompanyId)?.tradeName ?? null)
        : category.createdByWorkerId
          ? (creatorWorkersById.get(category.createdByWorkerId)?.fullName ?? null)
          : null;
      return { id: category.id, name: category.name, createdByName };
    }),
  };
}
