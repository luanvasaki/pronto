import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, jobs, skillCategories, workerProfiles } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { calculateAge } from '../../shared/age';
import { HttpError } from '../../shared/errors/http-error';
import { JobInput, validateJobInput } from './job-input-validation';
import { JobResponse, toJobResponse } from './job-response';

const ADULT_AGE_YEARS = 18;

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

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a essa vaga.');

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

  // Mesma lógica do guard de positionsTotal acima: não dá pra tirar uma
  // permissão já usada. Sem isso, a empresa podia desmarcar "disponível
  // pra menores" com um trabalhador de 16-17 anos já aprovado e
  // trabalhando na vaga — o front nunca mostra esse estado (a tela de
  // detalhe já bloqueia candidatura nova de menor quando minorsAllowed é
  // false, ver get-job-detail.ts), mas ninguém tira o turno já criado.
  if (job.minorsAllowed && !validated.minorsAllowed) {
    const approvedApplications = await db.query.applications.findMany({
      where: and(eq(applications.jobId, jobId), eq(applications.status, 'approved')),
    });
    if (approvedApplications.length > 0) {
      const approvedWorkers = await db.query.workerProfiles.findMany({
        where: inArray(
          workerProfiles.userId,
          approvedApplications.map((application) => application.workerId),
        ),
      });
      const hasApprovedMinor = approvedWorkers.some(
        (worker) => Boolean(worker.birthDate) && calculateAge(worker.birthDate!, new Date()) < ADULT_AGE_YEARS,
      );
      if (hasApprovedMinor) {
        throw new HttpError(
          400,
          'Não é possível desmarcar "disponível pra menores de idade" — já existe um trabalhador menor de idade aprovado nessa vaga.',
        );
      }
    }
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
      requiresExperience: validated.requiresExperience,
      dressCode: validated.dressCode,
      toolsRequired: validated.toolsRequired,
      cnhCategory: validated.cnhCategory,
      cnhRequired: validated.cnhRequired,
      mealProvision: validated.mealProvision,
      mealAmount: validated.mealAmount,
      transportProvision: validated.transportProvision,
      transportAmount: validated.transportAmount,
      minorsAllowed: validated.minorsAllowed,
      addressLabel: validated.addressLabel,
      locationLat: validated.locationLat,
      locationLng: validated.locationLng,
      positionsTotal: validated.positionsTotal,
      payAmount: validated.payAmount,
      startsAt: validated.startsAt,
      endsAt: validated.endsAt,
      applicationsCloseAt: validated.applicationsCloseAt,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'open')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Só é possível editar vagas abertas.');
  }

  return toJobResponse(updated);
}
