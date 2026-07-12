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

export function answerQuestion(questionId: string, answer: string): Promise<JobQuestion> {
  return apiFetch(`/questions/${questionId}/answer`, {
    method: 'PATCH',
    body: JSON.stringify({ answer }),
  });
}
