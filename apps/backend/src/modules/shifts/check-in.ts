import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts, skillCategories, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { sendPushToUser } from '../push/send-push-notification';
import { ShiftResponse, toShiftResponse } from './shift-response';

/** UPDATE condicional (WHERE status = 'scheduled') fecha a corrida de dois check-ins simultâneos. */
export async function checkIn(workerId: string, shiftId: string): Promise<ShiftResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }
  if (shift.workerId !== workerId) {
    throw new HttpError(403, 'Você não tem acesso a esse turno.');
  }
  if (shift.status !== 'scheduled') {
    throw new HttpError(400, 'Esse turno não está esperando check-in.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const [updated] = await db
    .update(shifts)
    .set({
      status: 'checked_in',
      checkInAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'scheduled')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse turno não está esperando check-in.');
  }

  await notifyCompanyOfCheckIn(job, workerId);

  return toShiftResponse(updated);
}

/**
 * Só loga, nunca lança: o check-in do trabalhador precisa sempre suceder
 * mesmo que essa notificação falhe (sendPushToUser já não lança por
 * conta própria — esse try/catch cobre as buscas de company/worker/
 * category, que ficam fora dele).
 */
async function notifyCompanyOfCheckIn(job: typeof jobs.$inferSelect, workerId: string): Promise<void> {
  try {
    const [company, worker, category] = await Promise.all([
      db.query.companies.findFirst({ where: eq(companies.id, job.companyId) }),
      db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, workerId) }),
      db.query.skillCategories.findFirst({ where: eq(skillCategories.id, job.categoryId) }),
    ]);
    if (!company || !worker) return;

    await sendPushToUser(company.ownerUserId, {
      title: `${worker.fullName} fez check-in`,
      body: category?.name ?? 'Turno',
      url: '/escala',
    });
  } catch (error) {
    console.error('[checkIn] falha ao notificar a empresa do check-in:', error);
  }
}
