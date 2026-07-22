import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, workerProfiles } from '../../db/schema';
import { isMinor as checkIsMinor } from '../../shared/age';
import { HttpError } from '../../shared/errors/http-error';
import { isUniqueViolation } from '../../shared/is-unique-violation';
import { getLatestConsentDocument } from '../consent-documents/get-consent-document';
import { areApplicationsClosed } from '../jobs/applications-close';
import { satisfiesCnhRequirement } from '../jobs/cnh';
import { ApplicationResponse, toApplicationResponse } from './application-response';

export interface CreateApplicationConsent {
  termsAccepted: boolean | undefined;
  ipAddress: string | null;
  userAgent: string | null;
}

export async function createApplication(
  workerId: string,
  jobId: string,
  consent: CreateApplicationConsent,
): Promise<ApplicationResponse> {
  const profile = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.userId, workerId),
  });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de se candidatar.');
  }
  if (profile.kycStatus !== 'approved') {
    throw new HttpError(403, 'Complete a verificação do seu documento antes de se candidatar.');
  }
  if (!consent.termsAccepted) {
    throw new HttpError(400, 'É preciso confirmar que essa candidatura é intermediação avulsa antes de se candidatar.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  // Sem isso, um usuário que é dono da empresa E tem perfil de trabalhador
  // (mesma conta testando os dois lados) pode se candidatar à própria
  // vaga — o turno resultante teria workerId === company owner, e
  // createRating (que decide o papel de quem avalia comparando
  // shift.workerId com quem chama) não conseguiria mais distinguir "a
  // empresa avaliando" de "o trabalhador avaliando".
  const jobCompany = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (jobCompany?.ownerUserId === workerId) {
    throw new HttpError(400, 'Você não pode se candidatar à própria vaga.');
  }

  if (job.status !== 'open' || job.positionsFilled >= job.positionsTotal) {
    throw new HttpError(400, 'Essa vaga não está mais aceitando candidaturas.');
  }
  if (areApplicationsClosed(job)) {
    throw new HttpError(400, 'As candidaturas pra essa vaga já fecharam.');
  }
  if (job.cnhRequired && job.cnhCategory && !satisfiesCnhRequirement(profile.cnhCategory, job.cnhCategory)) {
    throw new HttpError(400, `Essa vaga exige CNH categoria ${job.cnhCategory}.`);
  }
  const isMinor = checkIsMinor(profile.birthDate);
  if (isMinor && !job.minorsAllowed) {
    throw new HttpError(400, 'Essa vaga não está disponível pra menores de idade.');
  }

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)),
  });
  if (existing) {
    throw new HttpError(400, 'Você já se candidatou a essa vaga.');
  }

  const latestTerms = await getLatestConsentDocument('platform_terms');

  let application;
  try {
    [application] = await db
      .insert(applications)
      .values({
        jobId,
        workerId,
        termsAcceptedAt: new Date(),
        termsVersion: latestTerms.version,
        termsIpAddress: consent.ipAddress,
        termsUserAgent: consent.userAgent,
      })
      .returning();
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
