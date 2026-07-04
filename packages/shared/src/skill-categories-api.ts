import { apiFetch } from './api';

export interface SkillCategory {
  id: string;
  name: string;
}

export function listSkillCategories(): Promise<{ categories: SkillCategory[] }> {
  return apiFetch('/skill-categories');
}
