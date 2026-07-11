import { HttpError } from '../../shared/errors/http-error';
import { CnhCategory, isCnhCategory } from './cnh';

export interface JobInput {
  categoryId: string | undefined;
  description: string | undefined;
  requiresExperience: boolean | undefined;
  dressCode: string | undefined;
  toolsRequired: string | undefined;
  /** Undefined/vazio = vaga sem exigência de CNH. */
  cnhCategory: string | undefined;
  /** Só importa quando `cnhCategory` está preenchido — default false (preferência, não bloqueia). */
  cnhRequired: boolean | undefined;
  addressLabel: string | undefined;
  locationLat: number | undefined;
  locationLng: number | undefined;
  positionsTotal: number | undefined;
  payAmount: string | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
  /** Vazio/ausente = usa o padrão (1h antes de startsAt, ver applications-close.ts). */
  applicationsCloseAt: string | undefined;
}

export interface ValidatedJobFields {
  categoryId: string;
  description: string;
  requiresExperience: boolean;
  dressCode: string | null;
  toolsRequired: string | null;
  cnhCategory: CnhCategory | null;
  cnhRequired: boolean;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  payAmount: string;
  startsAt: Date;
  endsAt: Date;
  applicationsCloseAt: Date | null;
}

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Regras compartilhadas por createJob e updateJob — mesma vaga, mesmas
 * regras de formato, dois pontos de entrada. Não checa se a categoria
 * existe de verdade (isso precisa do banco) — quem chama faz essa
 * checagem depois, com o categoryId já validado como presente aqui.
 */
export function validateJobInput(input: JobInput): ValidatedJobFields {
  if (!input.categoryId) {
    throw new HttpError(400, 'Categoria é obrigatória.');
  }

  const description = input.description?.trim();
  if (!description || description.length < 10) {
    throw new HttpError(400, 'Descrição precisa ter pelo menos 10 caracteres.');
  }

  if (typeof input.requiresExperience !== 'boolean') {
    throw new HttpError(400, 'Informe se a vaga exige experiência anterior.');
  }

  const dressCode = input.dressCode?.trim();
  if (dressCode && dressCode.length > 255) {
    throw new HttpError(400, 'Vestimenta exigida muito longa.');
  }

  const toolsRequired = input.toolsRequired?.trim();
  if (toolsRequired && toolsRequired.length > 255) {
    throw new HttpError(400, 'Ferramentas exigidas muito longas.');
  }

  const rawCnhCategory = input.cnhCategory?.trim();
  if (rawCnhCategory && !isCnhCategory(rawCnhCategory)) {
    throw new HttpError(400, 'Categoria de CNH inválida.');
  }
  if (input.cnhRequired && !rawCnhCategory) {
    throw new HttpError(400, 'Escolha a categoria de CNH exigida.');
  }
  const cnhCategory: CnhCategory | null = rawCnhCategory && isCnhCategory(rawCnhCategory) ? rawCnhCategory : null;

  const addressLabel = input.addressLabel?.trim();
  if (!addressLabel || addressLabel.length < 2) {
    throw new HttpError(400, 'Endereço é obrigatório.');
  }

  if (typeof input.locationLat !== 'number' || input.locationLat < -90 || input.locationLat > 90) {
    throw new HttpError(400, 'Latitude inválida.');
  }
  if (typeof input.locationLng !== 'number' || input.locationLng < -180 || input.locationLng > 180) {
    throw new HttpError(400, 'Longitude inválida.');
  }

  if (
    typeof input.positionsTotal !== 'number' ||
    !Number.isInteger(input.positionsTotal) ||
    input.positionsTotal < 1
  ) {
    throw new HttpError(400, 'Número de vagas precisa ser pelo menos 1.');
  }

  if (!input.payAmount || !PAY_AMOUNT_REGEX.test(input.payAmount) || Number(input.payAmount) <= 0) {
    throw new HttpError(400, 'Valor do pagamento inválido.');
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : undefined;
  const endsAt = input.endsAt ? new Date(input.endsAt) : undefined;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    throw new HttpError(400, 'Data de início inválida.');
  }
  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    throw new HttpError(400, 'Data de término inválida.');
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new HttpError(400, 'Data de término precisa ser depois do início.');
  }
  if (startsAt.getTime() < Date.now()) {
    throw new HttpError(400, 'Data de início precisa ser no futuro.');
  }

  let applicationsCloseAt: Date | null = null;
  if (input.applicationsCloseAt) {
    applicationsCloseAt = new Date(input.applicationsCloseAt);
    if (Number.isNaN(applicationsCloseAt.getTime())) {
      throw new HttpError(400, 'Prazo pra se candidatar inválido.');
    }
    if (applicationsCloseAt.getTime() > startsAt.getTime()) {
      throw new HttpError(400, 'Prazo pra se candidatar precisa ser até o início do turno.');
    }
    if (applicationsCloseAt.getTime() < Date.now()) {
      throw new HttpError(400, 'Prazo pra se candidatar precisa ser no futuro.');
    }
  }

  return {
    categoryId: input.categoryId,
    description,
    requiresExperience: input.requiresExperience,
    dressCode: dressCode || null,
    toolsRequired: toolsRequired || null,
    cnhCategory,
    cnhRequired: Boolean(cnhCategory) && Boolean(input.cnhRequired),
    addressLabel,
    locationLat: input.locationLat,
    locationLng: input.locationLng,
    positionsTotal: input.positionsTotal,
    payAmount: input.payAmount,
    startsAt,
    endsAt,
    applicationsCloseAt,
  };
}
