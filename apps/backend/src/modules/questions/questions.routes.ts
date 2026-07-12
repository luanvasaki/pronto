import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { answerQuestionHandler } from './answer-question.controller';
import { createQuestionHandler } from './create-question.controller';
import { listJobQuestionsHandler } from './list-job-questions.controller';

export const questionsRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

questionsRoutes.post('/jobs/:jobId/questions', requireAuth, writeRateLimiter, createQuestionHandler);
questionsRoutes.get('/jobs/:jobId/questions', requireAuth, listJobQuestionsHandler);
questionsRoutes.patch('/questions/:id/answer', requireAuth, writeRateLimiter, answerQuestionHandler);
