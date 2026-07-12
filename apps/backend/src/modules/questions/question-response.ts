import { jobQuestions } from '../../db/schema';

type JobQuestionRow = typeof jobQuestions.$inferSelect;

export interface JobQuestionResponse {
  id: string;
  jobId: string;
  question: string;
  answer: string | null;
  answeredAt: Date | null;
  createdAt: Date;
  worker: {
    id: string;
    fullName: string;
  };
}

export function toQuestionResponse(question: JobQuestionRow, workerFullName: string): JobQuestionResponse {
  return {
    id: question.id,
    jobId: question.jobId,
    question: question.question,
    answer: question.answer,
    answeredAt: question.answeredAt,
    createdAt: question.createdAt,
    worker: {
      id: question.workerId,
      fullName: workerFullName,
    },
  };
}
