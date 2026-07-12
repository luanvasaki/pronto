import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { applications, companies } from '../db/schema';
import { HttpError } from './errors/http-error';

/**
 * Confirma que `userId` pode ver o conteúdo "público entre inscritos"
 * de uma vaga — dono da empresa OU qualquer usuário com uma
 * candidatura (qualquer status: pendente, aprovada, rejeitada,
 * retirada) pra essa vaga. Lança 403 se nenhuma das duas for verdade.
 *
 * Mesma regra usada por list-job-announcements.ts e
 * list-job-questions.ts — não serve pra get-job-detail.ts, que tem uma
 * regra diferente (vaga aberta é pública pra qualquer trabalhador,
 * sem checar dono nem candidatura; só vaga fechada exige candidatura).
 */
export async function assertCanViewJob(userId: string, jobId: string, companyId: string): Promise<void> {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  const isOwner = company?.ownerUserId === userId;

  if (isOwner) {
    return;
  }

  const application = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, jobId), eq(applications.workerId, userId)),
  });
  if (!application) {
    throw new HttpError(403, 'Você não tem acesso a essa vaga.');
  }
}
