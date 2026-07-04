import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, jobs, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ApplicationResponse, toApplicationResponse } from './application-response';

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

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)),
  });
  if (existing) {
    throw new HttpError(400, 'Você já se candidatou a essa vaga.');
  }

  const [application] = await db.insert(applications).values({ jobId, workerId }).returning();
  if (!application) {
    throw new HttpError(500, 'Não foi possível enviar a candidatura.');
  }

  return toApplicationResponse(application);
}
