import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface CompanyProfileDetails {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  verificationStatus: string;
  avgRating: string | null;
  totalJobsPosted: number;
}

export async function getCompanyProfile(ownerUserId: string): Promise<CompanyProfileDetails> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver o perfil.');
  }

  return {
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName,
    cnpj: company.cnpj,
    verificationStatus: company.verificationStatus,
    avgRating: company.avgRating,
    totalJobsPosted: company.totalJobsPosted,
  };
}
