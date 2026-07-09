import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createSkillCategoryHandler } from './create-skill-category.controller';
import { listSkillCategoriesHandler } from './list-skill-categories.controller';

export const skillCategoriesRoutes = Router();

skillCategoriesRoutes.get('/skill-categories', listSkillCategoriesHandler);
skillCategoriesRoutes.post('/skill-categories', requireAuth, createSkillCategoryHandler);
