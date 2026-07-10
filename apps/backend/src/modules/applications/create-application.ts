import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, jobs, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { areApplicationsClosed } from '../jobs/applications-close';
import { ApplicationResponse, toApplicationResponse } from './application-response';

/**
 * A checagem de duplicata abaixo previne o caso comum, mas não fecha a
 * corrida entre duas requisições simultâneas (duplo clique, rede
 * lenta) — as duas passam pela checagem antes de qualquer insert
 * terminar. O índice único do banco pega isso de verdade; aqui só
 * traduz o erro cru do Postgres pra mensagem amigável.
 */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const causeCode = (error.cause as { code?: unknown } | undefined)?.code;
  return code === '23505' || causeCode === '23505';
}

export async function createApplication(workerId: string, jobId: string): Promise<ApplicationResponse> {
  const profile = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.userId, workerId),
  });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de se candidatar.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }
  if (job.status !== 'open' || job.positionsFilled >= job.positionsTotal) {
    throw new HttpError(400, 'Essa vaga não está mais aceitando candidaturas.');
  }
  if (areApplicationsClosed(job)) {
    throw new HttpError(400, 'As candidaturas pra essa vaga já fecharam.');
  }

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)),
  });
  if (existing) {
    throw new HttpError(400, 'Você já se candidatou a essa vaga.');
  }

  let application;
  try {
    [application] = await db.insert(applications).values({ jobId, workerId }).returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(400, 'Você já se candidatou a essa vaga.');
    }
    throw error;
  }
  if (!application) {
    throw new HttpError(500, 'Não foi possível enviar a candidatura.');
  }

  return toApplicationResponse(application);
}
