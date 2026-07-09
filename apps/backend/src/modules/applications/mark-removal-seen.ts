import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ApplicationResponse, toApplicationResponse } from './application-response';

/** O próprio trabalhador confirma que viu que foi removido de um turno já aprovado. */
export async function markRemovalSeen(workerId: string, applicationId: string): Promise<ApplicationResponse> {
  const application = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!application) {
    throw new HttpError(404, 'Candidatura não encontrada.');
  }
  if (application.workerId !== workerId) {
    throw new HttpError(403, 'Você não tem acesso a essa candidatura.');
  }

  if (application.workerSeenRemovalAt) {
    return toApplicationResponse(application);
  }

  const [updated] = await db
    .update(applications)
    .set({ workerSeenRemovalAt: new Date() })
    .where(eq(applications.id, applicationId))
    .returning();
  if (!updated) {
    throw new HttpError(500, 'Não foi possível atualizar a candidatura.');
  }

  return toApplicationResponse(updated);
}
