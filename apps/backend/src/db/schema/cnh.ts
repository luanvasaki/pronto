import { pgEnum } from 'drizzle-orm/pg-core';

// Categorias oficiais de CNH no Brasil. Compartilhado entre worker_profiles
// (categoria que o trabalhador tem) e jobs (categoria que a vaga exige/prefere) —
// só um enum Postgres, então definido uma vez aqui e importado nos dois lugares.
export const cnhCategoryEnum = pgEnum('cnh_category', ['A', 'B', 'AB', 'C', 'D', 'E']);
