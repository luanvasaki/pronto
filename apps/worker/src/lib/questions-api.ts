import { apiFetch } from '@shift/shared';

export interface JobQuestion {
  id: string;
  jobId: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  worker: {
    id: string;
    fullName: string;
  };
}

export function listJobQuestions(jobId: string): Promise<{ questions: JobQuestion[] }> {
  return apiFetch(`/jobs/${jobId}/questions`);
}

export function askQuestion(jobId: string, question: string): Promise<JobQuestion> {
  return apiFetch(`/jobs/${jobId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
