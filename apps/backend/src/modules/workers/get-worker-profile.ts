import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, documents, jobs, shifts, workerProfiles, workerSkills } from '../../db/schema';
import { updateWorkerRatingAggregate } from '../ratings/update-rating-aggregates';
import { HttpError } from '../../shared/errors/http-error';

export interface WorkerProfileDetails {
  fullName: string;
  bio: string | null;
  cpf: string | null;
  categoryIds: string[];
  experienceByCategory: Record<string, boolean>;
  photoUrl: string | null;
  homeAddressLabel: string | null;
  kycStatus: string;
  hasDocument: boolean;
  avgRating: string | null;
  avgCategoryScores: Record<string, string> | null;
  totalShiftsCompleted: number;
  totalHoursWorked: number;
  companiesServed: number;
  rehireRate: number | null;
  attendanceRate: number | null;
  cancellations: number;
}

export async function getWorkerProfile(userId: string): Promise<WorkerProfileDetails> {
  // Recalcula antes de ler — pega tanto avaliação nova quanto avaliação que
  // só virou visível agora porque o prazo de 7 dias venceu (ver
  // rating-visibility.ts). Sem isso, essa segunda revelação nunca
  // apareceria sem uma avaliação nova disparando o recalculo.
  await updateWorkerRatingAggregate(userId);

  const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, userId) });
  if (!profile) {
    throw new HttpError(404, 'Complete seu cadastro antes de ver o perfil.');
  }

  const skills = await db.query.workerSkills.findMany({ where: eq(workerSkills.workerId, userId) });
  const document = await db.query.documents.findFirst({ where: eq(documents.workerId, userId) });

  // "Horas de voo": calculadas ao vivo a partir dos turnos concluídos —
  // as colunas `totalShiftsCompleted`/`totalNoShows` de `worker_profiles`
  // nunca são atualizadas por nenhum código, então não são confiáveis.
  // `checkedIn`/`noShow` entram aqui só pra calcular comparecimento
  // (turnos `cancelled` ficam de fora de propósito — cancelamento é
  // sempre iniciativa da empresa, ver cancel-job.ts/remove-approved-worker.ts,
  // não é falha do trabalhador).
  const [stats] = await db
    .select({
      totalShiftsCompleted: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
      totalHoursWorked: sql<string>`coalesce(sum(extract(epoch from (${shifts.checkOutAt} - ${shifts.checkInAt}))) filter (where ${shifts.status} = 'completed' and ${shifts.checkOutAt} is not null and ${shifts.checkInAt} is not null), 0) / 3600`,
      checkedIn: sql<string>`count(*) filter (where ${shifts.status} = 'checked_in')`,
      noShow: sql<string>`count(*) filter (where ${shifts.status} = 'no_show')`,
    })
    .from(shifts)
    .where(eq(shifts.workerId, userId));

  // Empresas atendidas e taxa de recontratação: turnos concluídos
  // agrupados por empresa (via jobs.company_id) — quantas empresas te
  // contrataram pelo menos 1x, e quantas dessas te chamaram de novo (2+).
  const companyShiftCounts = await db
    .select({
      companyId: jobs.companyId,
      completedCount: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
    })
    .from(shifts)
    .innerJoin(jobs, eq(shifts.jobId, jobs.id))
    .where(eq(shifts.workerId, userId))
    .groupBy(jobs.companyId);

  const companiesServed = companyShiftCounts.filter((row) => Number(row.completedCount) >= 1).length;
  const companiesRehired = companyShiftCounts.filter((row) => Number(row.completedCount) >= 2).length;

  // Cancelamentos: única forma hoje do trabalhador cancelar algo é desistir
  // de uma candidatura ainda pendente (ver withdraw-application.ts) — depois
  // de aprovada, não existe cancelamento pelo lado do trabalhador.
  const [{ cancellations = 0 } = { cancellations: 0 }] = await db
    .select({ cancellations: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.workerId, userId), eq(applications.status, 'withdrawn')));

  const totalShiftsCompleted = Number(stats?.totalShiftsCompleted ?? 0);
  const checkedIn = Number(stats?.checkedIn ?? 0);
  const noShow = Number(stats?.noShow ?? 0);
  const attendanceDenominator = totalShiftsCompleted + checkedIn + noShow;

  return {
    fullName: profile.fullName,
    bio: profile.bio,
    cpf: profile.cpf,
    categoryIds: skills.map((skill) => skill.categoryId),
    experienceByCategory: Object.fromEntries(skills.map((skill) => [skill.categoryId, skill.hasExperience])),
    photoUrl: profile.photoUrl,
    homeAddressLabel: profile.homeAddressLabel,
    kycStatus: profile.kycStatus,
    hasDocument: Boolean(document),
    avgRating: profile.avgRating,
    avgCategoryScores: profile.avgCategoryScores ?? null,
    totalShiftsCompleted,
    totalHoursWorked: Math.round(Number(stats?.totalHoursWorked ?? 0) * 10) / 10,
    companiesServed,
    rehireRate: companiesServed > 0 ? Math.round((companiesRehired / companiesServed) * 100) : null,
    attendanceRate:
      attendanceDenominator > 0 ? Math.round(((totalShiftsCompleted + checkedIn) / attendanceDenominator) * 100) : null,
    cancellations: Number(cancellations),
  };
}
