import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies } from '../../db/schema';
import { isValidCnpj, isValidCpf } from '../../shared/cpf-cnpj';
import { HttpError } from '../../shared/errors/http-error';

const BUSINESS_SEGMENTS = ['bar', 'restaurante', 'buffet', 'hotel', 'eventos', 'casa_noturna', 'outro'] as const;
export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number];

function isBusinessSegment(value: string): value is BusinessSegment {
  return (BUSINESS_SEGMENTS as readonly string[]).includes(value);
}

const PERSON_TYPES = ['juridica', 'fisica'] as const;
export type CompanyPersonType = (typeof PERSON_TYPES)[number];

function isPersonType(value: string): value is CompanyPersonType {
  return (PERSON_TYPES as readonly string[]).includes(value);
}

export interface UpsertCompanyProfileInput {
  legalName: string | undefined;
  tradeName: string | undefined;
  /** Ausente/vazio = 'juridica' (padrão) — empresa de verdade, com CNPJ. */
  personType: string | undefined;
  cnpj: string | undefined;
  /** Só usado (e obrigatório) quando personType === 'fisica'. */
  cpf: string | undefined;
  addressLabel: string | undefined;
  businessSegment: string | undefined;
  businessSegmentOther: string | undefined;
}

export interface CompanyProfileResponse {
  id: string;
  legalName: string;
  tradeName: string;
  personType: string;
  cnpj: string | null;
  cpf: string | null;
  addressLabel: string | null;
  businessSegment: string | null;
  businessSegmentOther: string | null;
  verificationStatus: string;
}

/**
 * Cria ou atualiza numa chamada só, igual ao perfil do trabalhador.
 * `ownerUserId` tem índice único (uma empresa por dono no MVP), então
 * o upsert usa ele como alvo do conflito. Endereço e ramo são
 * opcionais — só informativos, não afetam distância/matching (isso
 * continua sendo por vaga, não por empresa).
 *
 * `personType` decide qual documento é exigido: 'juridica' (padrão)
 * pede CNPJ, 'fisica' pede CPF — pra deixar uma pessoa física também
 * contratar freelancer avulso sem precisar abrir CNPJ. Só um dos dois
 * é validado/salvo por vez; o outro fica null.
 */
export async function upsertCompanyProfile(
  ownerUserId: string,
  input: UpsertCompanyProfileInput,
): Promise<CompanyProfileResponse> {
  const legalName = input.legalName?.trim();
  const tradeName = input.tradeName?.trim();
  const addressLabel = input.addressLabel?.trim();

  if (!legalName || legalName.length < 2) {
    throw new HttpError(400, 'Razão social é obrigatória.');
  }

  if (!tradeName || tradeName.length < 2) {
    throw new HttpError(400, 'Nome fantasia é obrigatório.');
  }

  const rawPersonType = input.personType?.trim();
  if (rawPersonType && !isPersonType(rawPersonType)) {
    throw new HttpError(400, 'Tipo de cadastro inválido.');
  }
  const personType: CompanyPersonType = rawPersonType && isPersonType(rawPersonType) ? rawPersonType : 'juridica';

  let cnpj: string | undefined;
  let cpf: string | undefined;
  if (personType === 'juridica') {
    cnpj = input.cnpj?.trim();
    if (!cnpj || !isValidCnpj(cnpj)) {
      throw new HttpError(400, 'CNPJ inválido — envie só os 14 números.');
    }
  } else {
    cpf = input.cpf?.trim();
    if (!cpf || !isValidCpf(cpf)) {
      throw new HttpError(400, 'CPF inválido — envie só os 11 números.');
    }
  }

  if (input.businessSegment && !isBusinessSegment(input.businessSegment)) {
    throw new HttpError(400, 'Ramo de atividade inválido.');
  }
  const businessSegment = input.businessSegment as BusinessSegment | undefined;

  const businessSegmentOther = input.businessSegmentOther?.trim();
  if (businessSegment === 'outro' && !businessSegmentOther) {
    throw new HttpError(400, 'Digite qual é o ramo de atividade.');
  }

  if (cnpj) {
    const cnpjOwner = await db.query.companies.findFirst({ where: eq(companies.cnpj, cnpj) });
    if (cnpjOwner && cnpjOwner.ownerUserId !== ownerUserId) {
      throw new HttpError(400, 'Esse CNPJ já está cadastrado.');
    }
  }
  if (cpf) {
    const cpfOwner = await db.query.companies.findFirst({ where: eq(companies.cpf, cpf) });
    if (cpfOwner && cpfOwner.ownerUserId !== ownerUserId) {
      throw new HttpError(400, 'Esse CPF já está cadastrado.');
    }
  }

  // Só guarda o texto livre quando o ramo escolhido é "outro" — trocar
  // pra um ramo do enum descarta o texto anterior, não deixa lixo salvo.
  const businessSegmentOtherToSave = businessSegment === 'outro' ? businessSegmentOther : null;

  // Trocar a identidade (razão social, CNPJ ou CPF) depois de aprovada
  // volta a empresa pra "pending" — o admin verificou os dados
  // antigos, não os novos. Endereço/ramo/logo não mexem nisso, só
  // servem de informação, não provam identidade.
  const existing = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  const identityChanged =
    !!existing &&
    (existing.legalName !== legalName || existing.cnpj !== (cnpj ?? null) || existing.cpf !== (cpf ?? null));
  const shouldResetVerification = identityChanged && existing?.verificationStatus === 'approved';

  const [company] = await db
    .insert(companies)
    .values({
      ownerUserId,
      legalName,
      tradeName,
      personType,
      cnpj: cnpj ?? null,
      cpf: cpf ?? null,
      addressLabel: addressLabel || undefined,
      businessSegment,
      businessSegmentOther: businessSegmentOtherToSave,
    })
    .onConflictDoUpdate({
      target: companies.ownerUserId,
      set: {
        legalName,
        tradeName,
        personType,
        cnpj: cnpj ?? null,
        cpf: cpf ?? null,
        addressLabel: addressLabel || null,
        businessSegment: businessSegment ?? null,
        businessSegmentOther: businessSegmentOtherToSave,
        updatedAt: new Date(),
        ...(shouldResetVerification ? { verificationStatus: 'pending' as const } : {}),
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
    personType: company.personType,
    cnpj: company.cnpj,
    cpf: company.cpf,
    addressLabel: company.addressLabel,
    businessSegment: company.businessSegment,
    businessSegmentOther: company.businessSegmentOther,
    verificationStatus: company.verificationStatus,
  };
}
