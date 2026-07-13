import { and, eq, gte, lt, ne } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { createJob } from './create-job';
import { JobResponse } from './job-response';

export interface DuplicateWeekInput {
  sourceWeekStart: Date;
  targetWeekStart: Date;
  termsAccepted: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Duplica todas as vagas não canceladas que começam na semana de origem pra
 * semana de destino, preservando dia da semana e horário — mesma regra do
 * "Duplicar" de uma vaga só (vagas/nova?template=), só que em lote: cada
 * vaga nasce como uma vaga nova de verdade via createJob (positionsFilled
 * sempre reinicia em 0, candidaturas/turnos nunca são copiados).
 *
 * Reusa createJob (não insere direto na tabela) de propósito — assim toda
 * regra de negócio da criação normal (empresa verificada, categoria válida,
 * data no futuro etc.) vale igual aqui, sem duplicar validação.
 */
export async function duplicateWeek(ownerUserId: string, input: DuplicateWeekInput): Promise<JobResponse[]> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de duplicar uma semana.');
  }

  const sourceWeekEnd = new Date(input.sourceWeekStart.getTime() + WEEK_MS);
  const sourceJobs = await db.query.jobs.findMany({
    where: and(
      eq(jobs.companyId, company.id),
      ne(jobs.status, 'cancelled'),
      gte(jobs.startsAt, input.sourceWeekStart),
      lt(jobs.startsAt, sourceWeekEnd),
    ),
    orderBy: (jobsTable, { asc }) => [asc(jobsTable.startsAt)],
  });

  if (sourceJobs.length === 0) {
    throw new HttpError(400, 'Não há escalas na semana de origem pra duplicar.');
  }

  const offsetMs = input.targetWeekStart.getTime() - input.sourceWeekStart.getTime();

  // Numa transação só — se uma vaga no meio do lote falhar na validação
  // (createJob), as anteriores não ficam commitadas sozinhas: ou a semana
  // duplica inteira, ou nenhuma vaga nova é criada.
  return db.transaction(async (tx) => {
    const created: JobResponse[] = [];
    for (const sourceJob of sourceJobs) {
      const startsAt = new Date(sourceJob.startsAt.getTime() + offsetMs);
      const endsAt = new Date(sourceJob.endsAt.getTime() + offsetMs);
      const applicationsCloseAt = sourceJob.applicationsCloseAt
        ? new Date(sourceJob.applicationsCloseAt.getTime() + offsetMs)
        : undefined;

      const job = await createJob(
        ownerUserId,
        {
          categoryId: sourceJob.categoryId,
          description: sourceJob.description,
          requiresExperience: sourceJob.requiresExperience,
          dressCode: sourceJob.dressCode ?? undefined,
          toolsRequired: sourceJob.toolsRequired ?? undefined,
          cnhCategory: sourceJob.cnhCategory ?? undefined,
          cnhRequired: sourceJob.cnhRequired,
          offersMeal: sourceJob.offersMeal,
          offersTransport: sourceJob.offersTransport,
          addressLabel: sourceJob.addressLabel,
          locationLat: sourceJob.locationLat,
          locationLng: sourceJob.locationLng,
          positionsTotal: sourceJob.positionsTotal,
          payAmount: sourceJob.payAmount,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          applicationsCloseAt: applicationsCloseAt?.toISOString(),
        },
        input.termsAccepted,
        tx,
      );
      created.push(job);
    }

    return created;
  });
}
