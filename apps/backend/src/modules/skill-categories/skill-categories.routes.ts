import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { createSkillCategoryHandler } from './create-skill-category.controller';
import { listSkillCategoriesHandler } from './list-skill-categories.controller';

export const skillCategoriesRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

skillCategoriesRoutes.get('/skill-categories', listSkillCategoriesHandler);
skillCategoriesRoutes.post('/skill-categories', requireAuth, writeRateLimiter, createSkillCategoryHandler);
