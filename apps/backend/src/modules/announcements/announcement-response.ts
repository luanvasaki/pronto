import { jobAnnouncements } from '../../db/schema';

type JobAnnouncementRow = typeof jobAnnouncements.$inferSelect;

export interface AnnouncementResponse {
  id: string;
  jobId: string;
  message: string;
  createdAt: Date;
}

export function toAnnouncementResponse(announcement: JobAnnouncementRow): AnnouncementResponse {
  return {
    id: announcement.id,
    jobId: announcement.jobId,
    message: announcement.message,
    createdAt: announcement.createdAt,
  };
}
