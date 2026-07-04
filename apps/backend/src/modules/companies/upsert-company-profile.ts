import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface UpsertCompanyProfileInput {
  legalName: string | undefined;
  tradeName: string | undefined;
  cnpj: string | undefined;
}

export interface CompanyProfileResponse {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  verificationStatus: string;
}

const CNPJ_REGEX = /^\d{14}$/;

/**
 * Cria ou atualiza numa chamada só, igual ao perfil do trabalhador.
 * `ownerUserId` tem índice único (uma empresa por dono no MVP), então
 * o upsert usa ele como alvo do conflito.
 */
export async function upsertCompanyProfile(
  ownerUserId: string,
  input: UpsertCompanyProfileInput,
): Promise<CompanyProfileResponse> {
  const legalName = input.legalName?.trim();
  const tradeName = input.tradeName?.trim();
  const cnpj = input.cnpj?.trim();

  if (!legalName || legalName.length < 2) {
    throw new HttpError(400, 'Razão social é obrigatória.');
  }

  if (!tradeName || tradeName.length < 2) {
    throw new HttpError(400, 'Nome fantasia é obrigatório.');
  }

  if (!cnpj || !CNPJ_REGEX.test(cnpj)) {
    throw new HttpError(400, 'CNPJ inválido — envie só os 14 números.');
  }

  const cnpjOwner = await db.query.companies.findFirst({ where: eq(companies.cnpj, cnpj) });
  if (cnpjOwner && cnpjOwner.ownerUserId !== ownerUserId) {
    throw new HttpError(400, 'Esse CNPJ já está cadastrado.');
  }

  const [company] = await db
    .insert(companies)
    .values({ ownerUserId, legalName, tradeName, cnpj })
    .onConflictDoUpdate({
      target: companies.ownerUserId,
      set: { legalName, tradeName, cnpj, updatedAt: new Date() },
    })
    .returning();

  if (!company) {
    throw new HttpError(500, 'Não foi possível salvar o perfil da empresa.');
  }

  return {
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName,
    cnpj: company.cnpj,
    verificationStatus: company.verificationStatus,
  };
}
