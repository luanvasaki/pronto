import { countDistinct, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, payments, shifts, workerProfiles } from '../../db/schema';

export interface AdminMetrics {
  payments: {
    totalProcessed: string;
    countByStatus: Record<string, number>;
  };
  workers: {
    total: number;
    verified: number;
    active: number;
  };
  companies: {
    total: number;
    verified: number;
    jobsPosted: number;
  };
  shifts: {
    completed: number;
    cancelled: number;
    noShow: number;
  };
}

/**
 * "Processado" = cobrado ou já liberado pro trabalhador (pending/failed/
 * refunded não entram na soma, só na contagem por status).
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [paymentTotals] = await db
    .select({
      totalProcessed: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} in ('charged', 'released', 'confirmed', 'disputed')), 0)`,
      pending: sql<number>`count(*) filter (where ${payments.status} = 'pending')`,
      charged: sql<number>`count(*) filter (where ${payments.status} = 'charged')`,
      released: sql<number>`count(*) filter (where ${payments.status} = 'released')`,
      confirmed: sql<number>`count(*) filter (where ${payments.status} = 'confirmed')`,
      disputed: sql<number>`count(*) filter (where ${payments.status} = 'disputed')`,
      failed: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
      refunded: sql<number>`count(*) filter (where ${payments.status} = 'refunded')`,
    })
    .from(payments);

  const [workerTotals] = await db
    .select({
      total: sql<number>`count(*)`,
      verified: sql<number>`count(*) filter (where ${workerProfiles.kycStatus} = 'approved')`,
    })
    .from(workerProfiles);

  const [{ active: activeWorkers = 0 } = { active: 0 }] = await db
    .select({ active: countDistinct(shifts.workerId) })
    .from(shifts)
    .where(eq(shifts.status, 'completed'));

  const [companyTotals] = await db
    .select({
      total: sql<number>`count(*)`,
      verified: sql<number>`count(*) filter (where ${companies.verificationStatus} = 'approved')`,
    })
    .from(companies);

  const [{ jobsPosted = 0 } = { jobsPosted: 0 }] = await db.select({ jobsPosted: sql<number>`count(*)` }).from(jobs);

  const [shiftTotals] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${shifts.status} = 'completed')`,
      cancelled: sql<number>`count(*) filter (where ${shifts.status} = 'cancelled')`,
      noShow: sql<number>`count(*) filter (where ${shifts.status} = 'no_show')`,
    })
    .from(shifts);

  return {
    payments: {
      totalProcessed: paymentTotals?.totalProcessed ?? '0',
      countByStatus: {
        pending: Number(paymentTotals?.pending ?? 0),
        charged: Number(paymentTotals?.charged ?? 0),
        released: Number(paymentTotals?.released ?? 0),
        confirmed: Number(paymentTotals?.confirmed ?? 0),
        disputed: Number(paymentTotals?.disputed ?? 0),
        failed: Number(paymentTotals?.failed ?? 0),
        refunded: Number(paymentTotals?.refunded ?? 0),
      },
    },
    workers: {
      total: Number(workerTotals?.total ?? 0),
      verified: Number(workerTotals?.verified ?? 0),
      active: Number(activeWorkers ?? 0),
    },
    companies: {
      total: Number(companyTotals?.total ?? 0),
      verified: Number(companyTotals?.verified ?? 0),
      jobsPosted: Number(jobsPosted ?? 0),
    },
    shifts: {
      completed: Number(shiftTotals?.completed ?? 0),
      cancelled: Number(shiftTotals?.cancelled ?? 0),
      noShow: Number(shiftTotals?.noShow ?? 0),
    },
  };
}
