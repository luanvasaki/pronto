import { Router } from 'express';
import { listSkillCategoriesHandler } from './list-skill-categories.controller';

export const skillCategoriesRoutes = Router();

skillCategoriesRoutes.get('/skill-categories', listSkillCategoriesHandler);
