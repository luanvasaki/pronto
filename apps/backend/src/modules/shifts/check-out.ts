import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts, skillCategories, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { sendPushToUser } from '../push/send-push-notification';
import { ShiftResponse, toShiftResponse } from './shift-response';

/**
 * UPDATE condicional (WHERE status = 'checked_in') fecha a corrida de dois
 * check-outs simultâneos. Não finaliza o turno sozinho — vira 'checked_out',
 * esperando a empresa confirmar (ver confirm-check-out.ts), que é quem
 * dispara a cobrança.
 */
export async function checkOut(workerId: string, shiftId: string): Promise<ShiftResponse> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }
  if (shift.workerId !== workerId) {
    throw new HttpError(403, 'Você não tem acesso a esse turno.');
  }
  if (shift.status !== 'checked_in') {
    throw new HttpError(400, 'Esse turno não está esperando check-out.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const [updated] = await db
    .update(shifts)
    .set({
      status: 'checked_out',
      checkOutAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'checked_in')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse turno não está esperando check-out.');
  }

  await notifyCompanyOfCheckOut(job, workerId);

  return toShiftResponse(updated);
}

/** Mesmo espírito de notifyCompanyOfCheckIn em check-in.ts — nunca lança. */
async function notifyCompanyOfCheckOut(job: typeof jobs.$inferSelect, workerId: string): Promise<void> {
  try {
    const [company, worker, category] = await Promise.all([
      db.query.companies.findFirst({ where: eq(companies.id, job.companyId) }),
      db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, workerId) }),
      db.query.skillCategories.findFirst({ where: eq(skillCategories.id, job.categoryId) }),
    ]);
    if (!company || !worker) return;

    await sendPushToUser(company.ownerUserId, {
      title: `${worker.fullName} fez check-out`,
      body: category?.name ?? 'Turno',
      url: '/escala',
    });
  } catch (error) {
    console.error('[checkOut] falha ao notificar a empresa do check-out:', error);
  }
}
