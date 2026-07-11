import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

const BUSINESS_SEGMENTS = ['bar', 'restaurante', 'buffet', 'hotel', 'eventos', 'casa_noturna', 'outro'] as const;
export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number];

function isBusinessSegment(value: string): value is BusinessSegment {
  return (BUSINESS_SEGMENTS as readonly string[]).includes(value);
}

export interface UpsertCompanyProfileInput {
  legalName: string | undefined;
  tradeName: string | undefined;
  cnpj: string | undefined;
  addressLabel: string | undefined;
  businessSegment: string | undefined;
  businessSegmentOther: string | undefined;
}

export interface CompanyProfileResponse {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  addressLabel: string | null;
  businessSegment: string | null;
  businessSegmentOther: string | null;
  verificationStatus: string;
}

const CNPJ_REGEX = /^\d{14}$/;

/**
 * Cria ou atualiza numa chamada só, igual ao perfil do trabalhador.
 * `ownerUserId` tem índice único (uma empresa por dono no MVP), então
 * o upsert usa ele como alvo do conflito. Endereço e ramo são
 * opcionais — só informativos, não afetam distância/matching (isso
 * continua sendo por vaga, não por empresa).
 */
export async function upsertCompanyProfile(
  ownerUserId: string,
  input: UpsertCompanyProfileInput,
): Promise<CompanyProfileResponse> {
  const legalName = input.legalName?.trim();
  const tradeName = input.tradeName?.trim();
  const cnpj = input.cnpj?.trim();
  const addressLabel = input.addressLabel?.trim();

  if (!legalName || legalName.length < 2) {
    throw new HttpError(400, 'Razão social é obrigatória.');
  }

  if (!tradeName || tradeName.length < 2) {
    throw new HttpError(400, 'Nome fantasia é obrigatório.');
  }

  if (!cnpj || !CNPJ_REGEX.test(cnpj)) {
    throw new HttpError(400, 'CNPJ inválido — envie só os 14 números.');
  }

  if (input.businessSegment && !isBusinessSegment(input.businessSegment)) {
    throw new HttpError(400, 'Ramo de atividade inválido.');
  }
  const businessSegment = input.businessSegment as BusinessSegment | undefined;

  const businessSegmentOther = input.businessSegmentOther?.trim();
  if (businessSegment === 'outro' && !businessSegmentOther) {
    throw new HttpError(400, 'Digite qual é o ramo de atividade.');
  }

  const cnpjOwner = await db.query.companies.findFirst({ where: eq(companies.cnpj, cnpj) });
  if (cnpjOwner && cnpjOwner.ownerUserId !== ownerUserId) {
    throw new HttpError(400, 'Esse CNPJ já está cadastrado.');
  }

  // Só guarda o texto livre quando o ramo escolhido é "outro" — trocar
  // pra um ramo do enum descarta o texto anterior, não deixa lixo salvo.
  const businessSegmentOtherToSave = businessSegment === 'outro' ? businessSegmentOther : null;

  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId,
      legalName,
      tradeName,
      cnpj,
      addressLabel: addressLabel || undefined,
      businessSegment,
      businessSegmentOther: businessSegmentOtherToSave,
    })
    .onConflictDoUpdate({
      target: companies.ownerUserId,
      set: {
        legalName,
        tradeName,
        cnpj,
        addressLabel: addressLabel || null,
        businessSegment: businessSegment ?? null,
        businessSegmentOther: businessSegmentOtherToSave,
        updatedAt: new Date(),
      },
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
    addressLabel: company.addressLabel,
    businessSegment: company.businessSegment,
    businessSegmentOther: company.businessSegmentOther,
    verificationStatus: company.verificationStatus,
  };
}
