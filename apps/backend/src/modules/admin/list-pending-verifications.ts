import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, companyDocuments, documents, skillCategories, workerProfiles } from '../../db/schema';
import { calculateAge } from '../../shared/age';

const ADULT_AGE_YEARS = 18;

export interface PendingDocument {
  id: string;
  workerId: string;
  workerFullName: string;
  type: string;
  createdAt: Date;
  // Preenchidos só quando o trabalhador é menor (16-17) — dá pro admin
  // conferir quem está autorizando junto do documento do responsável
  // (type: 'guardian_identity'), sem precisar abrir outra tela.
  isMinor: boolean;
  guardianFullName: string | null;
  guardianCpf: string | null;
  guardianPhone: string | null;
}

export interface PendingCompany {
  id: string;
  legalName: string;
  tradeName: string;
  personType: string;
  cnpj: string | null;
  cpf: string | null;
  /** Só preenchido pra empresa pessoa física que já enviou documento (ver company-documents.ts). */
  documentId: string | null;
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
  const pendingCompanyIds = pendingCompanies.map((company) => company.id);
  const pendingCompanyDocuments =
    pendingCompanyIds.length > 0
      ? await db.query.companyDocuments.findMany({
          where: inArray(companyDocuments.companyId, pendingCompanyIds),
          orderBy: desc(companyDocuments.createdAt),
        })
      : [];
  // Mais recente primeiro (orderBy acima) — o primeiro `set` por
  // companyId já é o documento mais novo enviado por aquela empresa.
  const latestDocumentIdByCompanyId = new Map<string, string>();
  for (const document of pendingCompanyDocuments) {
    if (!latestDocumentIdByCompanyId.has(document.companyId)) {
      latestDocumentIdByCompanyId.set(document.companyId, document.id);
    }
  }

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
      const isMinor = Boolean(worker.birthDate) && calculateAge(worker.birthDate!, new Date()) < ADULT_AGE_YEARS;
      return [
        {
          id: document.id,
          workerId: document.workerId,
          workerFullName: worker.fullName,
          type: document.type,
          createdAt: document.createdAt,
          isMinor,
          guardianFullName: isMinor ? worker.guardianFullName : null,
          guardianCpf: isMinor ? worker.guardianCpf : null,
          guardianPhone: isMinor ? worker.guardianPhone : null,
        },
      ];
    }),
    companies: pendingCompanies.map((company) => ({
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      personType: company.personType,
      cnpj: company.cnpj,
      cpf: company.cpf,
      documentId: latestDocumentIdByCompanyId.get(company.id) ?? null,
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
