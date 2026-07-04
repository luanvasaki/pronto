import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, skillCategories } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { JobInput, validateJobInput } from './job-input-validation';
import { JobResponse, toJobResponse } from './job-response';

export type CreateJobInput = JobInput;

/** companyId sempre vem do dono autenticado, nunca do corpo da requisição. */
export async function createJob(ownerUserId: string, input: CreateJobInput): Promise<JobResponse> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(400, 'Complete o cadastro da empresa antes de publicar uma vaga.');
  }

  const validated = validateJobInput(input);

  const category = await db.query.skillCategories.findFirst({
    where: eq(skillCategories.id, validated.categoryId),
  });
  if (!category) {
    throw new HttpError(400, 'Categoria inválida.');
  }

  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: validated.categoryId,
      description: validated.description,
      addressLabel: validated.addressLabel,
      locationLat: validated.locationLat,
      locationLng: validated.locationLng,
      positionsTotal: validated.positionsTotal,
      payAmount: validated.payAmount,
      startsAt: validated.startsAt,
      endsAt: validated.endsAt,
    })
    .returning();

  if (!job) {
    throw new HttpError(500, 'Não foi possível criar a vaga.');
  }

  return toJobResponse(job);
}
