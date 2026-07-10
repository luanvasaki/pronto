import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ApplicationResponse, toApplicationResponse } from './application-response';

/**
 * Trabalhador desistindo da própria candidatura (se candidatou por
 * engano, por exemplo). Só enquanto ainda está pendente — depois que a
 * empresa aprova, desfazer já mexe em turno/vaga preenchida, que é o
 * mesmo caso de remove-approved-worker (hoje só do lado da empresa).
 */
export async function withdrawApplication(workerId: string, applicationId: string): Promise<ApplicationResponse> {
  const application = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!application) {
    throw new HttpError(404, 'Candidatura não encontrada.');
  }
  if (application.workerId !== workerId) {
    throw new HttpError(403, 'Você não tem acesso a essa candidatura.');
  }
  if (application.status !== 'pending') {
    throw new HttpError(400, 'Só é possível cancelar uma candidatura pendente.');
  }

  const [updated] = await db
    .update(applications)
    .set({ status: 'withdrawn', updatedAt: new Date() })
    .where(and(eq(applications.id, applicationId), eq(applications.status, 'pending')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Só é possível cancelar uma candidatura pendente.');
  }

  return toApplicationResponse(updated);
}
