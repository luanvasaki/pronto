import { applications } from '../../db/schema';

type ApplicationRow = typeof applications.$inferSelect;

export interface ApplicationResponse {
  id: string;
  jobId: string;
  workerId: string;
  status: string;
  workerSeenAt: Date | null;
  removedAt: Date | null;
  workerSeenRemovalAt: Date | null;
  createdAt: Date;
}

export function toApplicationResponse(application: ApplicationRow): ApplicationResponse {
  return {
    id: application.id,
    jobId: application.jobId,
    workerId: application.workerId,
    status: application.status,
    workerSeenAt: application.workerSeenAt,
    removedAt: application.removedAt,
    workerSeenRemovalAt: application.workerSeenRemovalAt,
    createdAt: application.createdAt,
  };
}
