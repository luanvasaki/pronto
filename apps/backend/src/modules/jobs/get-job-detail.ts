import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, workerProfiles, workerSkills } from '../../db/schema';
import { isMinor as checkIsMinor } from '../../shared/age';
import { HttpError } from '../../shared/errors/http-error';
import { satisfiesCnhRequirement } from './cnh';
import { JobResponse, toJobResponse } from './job-response';

export interface JobDetailResponse extends JobResponse {
  companyName: string;
  companyLogoUrl: string | null;
  companyAvgRating: string | null;
  /** Trabalhador não tem essa categoria no perfil — mostra aviso, mas não impede candidatura. */
  matchesSkills: boolean;
  experienceMismatch: boolean;
  cnhMismatch: boolean;
  /** Trabalhador é menor de idade e a vaga não aceita menor — bloqueia
   * a candidatura (ver create-application.ts), igual cnhMismatch com
   * cnhRequired. Não some da tela (diferente da listagem, que já filtra
   * isso antes — ver list-nearby-jobs.ts) porque chegar aqui só
   * acontece por link direto/histórico, e o trabalhador ainda pode
   * querer ver os detalhes mesmo sem poder aceitar. */
  minorMismatch: boolean;
  /** Já se candidatou (qualquer status) — evita mostrar o botão de candidatar de novo. */
  hasApplied: boolean;
}

/**
 * Detalhe de uma vaga pro trabalhador — usado tanto navegando a partir
 * de Início (vaga ainda aberta, buscando decidir se candidata) quanto
 * de Candidaturas (vaga de qualquer status, já que o histórico
 * continua acessível). Vaga que não é mais `open` só é visível pra
 * quem já tem uma candidatura nela — mesma regra de acesso de
 * list-job-announcements/list-job-questions.
 */
export async function getJobDetailForWorker(workerId: string, jobId: string): Promise<JobDetailResponse> {
  const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, workerId) });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de ver vagas.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const application = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)),
  });

  if (job.status !== 'open' && !application) {
    throw new HttpError(403, 'Você não tem acesso a essa vaga.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company) {
    throw new HttpError(404, 'Empresa não encontrada.');
  }

  const skill = await db.query.workerSkills.findFirst({
    where: and(eq(workerSkills.workerId, workerId), eq(workerSkills.categoryId, job.categoryId)),
  });

  const isMinor = checkIsMinor(profile.birthDate);

  return {
    ...toJobResponse(job),
    companyName: company.tradeName,
    companyLogoUrl: company.logoUrl,
    companyAvgRating: company.avgRating,
    matchesSkills: Boolean(skill),
    experienceMismatch: job.requiresExperience && !(skill?.hasExperience ?? false),
    cnhMismatch: Boolean(job.cnhCategory) && !satisfiesCnhRequirement(profile.cnhCategory, job.cnhCategory!),
    minorMismatch: isMinor && !job.minorsAllowed,
    hasApplied: Boolean(application),
  };
}
