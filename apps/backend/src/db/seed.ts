import 'dotenv/config';
import { closeDb, db } from './client';
import { skillCategories } from './schema';

/**
 * Seed é dado de negócio, não estrutura — por isso não vive numa
 * migração. Idempotente: rodar de novo não duplica linha (conflito
 * no nome único é ignorado).
 */
const MVP_CATEGORIES = ['Garçom', 'Cozinha', 'Segurança de evento'];

async function seed(): Promise<void> {
  await db
    .insert(skillCategories)
    .values(MVP_CATEGORIES.map((name) => ({ name })))
    .onConflictDoNothing();

  console.log(`Seed de categorias concluído (${MVP_CATEGORIES.length} categorias do MVP).`);
}

seed()
  .catch((error) => {
    console.error('Falha ao rodar o seed:', error);
    process.exitCode = 1;
  })
  .finally(closeDb);
