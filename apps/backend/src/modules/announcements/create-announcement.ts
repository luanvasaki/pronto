import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobAnnouncements, jobs } from '../../db/schema';
import { containsPhoneNumber } from '../../shared/validation/contains-phone-number';
import { HttpError } from '../../shared/errors/http-error';
import { AnnouncementResponse, toAnnouncementResponse } from './announcement-response';

/**
 * Só o dono da empresa da vaga publica avisos — sem checar o status
 * da vaga (diferente de updateJob): o aviso vale mesmo depois de
 * preenchida/cancelada, é assim que a empresa avisa os inscritos de
 * mudanças de última hora.
 */
export async function createAnnouncement(
  ownerUserId: string,
  jobId: string,
  message: string | undefined,
): Promise<AnnouncementResponse> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a essa vaga.');
  }

  const trimmed = message?.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Escreva o aviso antes de publicar.');
  }
  if (containsPhoneNumber(trimmed)) {
    throw new HttpError(400, 'Não é permitido compartilhar telefone no aviso.');
  }

  const [announcement] = await db.insert(jobAnnouncements).values({ jobId, message: trimmed }).returning();
  if (!announcement) {
    throw new HttpError(500, 'Não foi possível publicar o aviso.');
  }

  return toAnnouncementResponse(announcement);
}
