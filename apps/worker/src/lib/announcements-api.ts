import { apiFetch } from '@shift/shared';

export interface JobAnnouncement {
  id: string;
  jobId: string;
  message: string;
  createdAt: string;
}

export function listJobAnnouncements(jobId: string): Promise<{ announcements: JobAnnouncement[] }> {
  return apiFetch(`/jobs/${jobId}/announcements`);
}
