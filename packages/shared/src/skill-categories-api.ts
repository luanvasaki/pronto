import { apiFetch } from './api';

export interface SkillCategory {
  id: string;
  name: string;
}

export function listSkillCategories(): Promise<{ categories: SkillCategory[] }> {
  return apiFetch('/skill-categories');
}

export function createSkillCategory(name: string): Promise<SkillCategory> {
  return apiFetch('/skill-categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
