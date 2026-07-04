import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, skillCategories } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { JobResponse, toJobResponse } from './job-response';

export interface CreateJobInput {
  categoryId: string | undefined;
  description: string | undefined;
  addressLabel: string | undefined;
  locationLat: number | undefined;
  locationLng: number | undefined;
  positionsTotal: number | undefined;
  payAmount: string | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
}

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

/** companyId sempre vem do dono autenticado, nunca do corpo da requisição. */
export async function createJob(ownerUserId: string, input: CreateJobInput): Promise<JobResponse> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(400, 'Complete o cadastro da empresa antes de publicar uma vaga.');
  }

  if (!input.categoryId) {
    throw new HttpError(400, 'Categoria é obrigatória.');
  }
  const category = await db.query.skillCategories.findFirst({
    where: eq(skillCategories.id, input.categoryId),
  });
  if (!category) {
    throw new HttpError(400, 'Categoria inválida.');
  }

  const description = input.description?.trim();
  if (!description || description.length < 10) {
    throw new HttpError(400, 'Descrição precisa ter pelo menos 10 caracteres.');
  }

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

  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: input.categoryId,
      description,
      addressLabel,
      locationLat: input.locationLat,
      locationLng: input.locationLng,
      positionsTotal: input.positionsTotal,
      payAmount: input.payAmount,
      startsAt,
      endsAt,
    })
    .returning();

  if (!job) {
    throw new HttpError(500, 'Não foi possível criar a vaga.');
  }

  return toJobResponse(job);
}
