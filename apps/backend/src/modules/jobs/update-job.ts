import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, skillCategories } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { JobInput, validateJobInput } from './job-input-validation';
import { JobResponse, toJobResponse } from './job-response';

export type UpdateJobInput = JobInput;

/**
 * Substitui os dados da vaga (mesmo formato de createJob), só
 * enquanto ela está "open" — depois de preencher ou cancelar, os
 * dados já viraram histórico (o turno já congelou payAmountSnapshot
 * na aprovação), editar não faz mais sentido. UPDATE condicional
 * (WHERE status = 'open') fecha a corrida de editar bem no instante
 * em que uma candidatura é aprovada.
 */
export async function updateJob(
  ownerUserId: string,
  jobId: string,
  input: UpdateJobInput,
): Promise<JobResponse> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a essa vaga.');
  }

  if (job.status !== 'open') {
    throw new HttpError(400, 'Só é possível editar vagas abertas.');
  }

  const validated = validateJobInput(input);

  if (validated.positionsTotal < job.positionsFilled) {
    throw new HttpError(
      400,
      `Já existem ${job.positionsFilled} candidato(s) aprovado(s) — não dá pra reduzir o número de vagas abaixo disso.`,
    );
  }

  const category = await db.query.skillCategories.findFirst({
    where: eq(skillCategories.id, validated.categoryId),
  });
  if (!category) {
    throw new HttpError(400, 'Categoria inválida.');
  }

  const [updated] = await db
    .update(jobs)
    .set({
      categoryId: validated.categoryId,
      description: validated.description,
      addressLabel: validated.addressLabel,
      locationLat: validated.locationLat,
      locationLng: validated.locationLng,
      positionsTotal: validated.positionsTotal,
      payAmount: validated.payAmount,
      startsAt: validated.startsAt,
      endsAt: validated.endsAt,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'open')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Só é possível editar vagas abertas.');
  }

  return toJobResponse(updated);
}
