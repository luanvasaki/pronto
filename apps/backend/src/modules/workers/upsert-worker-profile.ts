import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { skillCategories, users, workerProfiles, workerSkills } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

const CPF_REGEX = /^\d{11}$/;

export interface UpsertWorkerProfileInput {
  fullName: string | undefined;
  categoryIds: string[] | undefined;
  // Só aceito quando igual ao googlePhotoUrl do próprio usuário (ver
  // checagem abaixo) — usar a foto do Google sem precisar de upload.
  // Upload de arquivo próprio sempre passa por POST /worker-profile/photo,
  // nunca por aqui, já que aquele endpoint gera a URL no servidor.
  photoUrl: string | undefined;
  bio: string | undefined;
  cpf: string | undefined;
  // Opcional — quando uma categoria de `categoryIds` não aparece aqui,
  // o valor anterior dela é preservado (troca de categoria pelo /perfil
  // não reseta a experiência já declarada); categoria nova sem entrada
  // aqui vira `false`.
  experienceByCategory: Record<string, boolean> | undefined;
}

export interface WorkerProfileResponse {
  fullName: string;
  categoryIds: string[];
  photoUrl: string | null;
  bio: string | null;
  cpf: string | null;
  experienceByCategory: Record<string, boolean>;
}

/**
 * Cria ou atualiza numa chamada só — a tela de cadastro manda nome +
 * categorias juntos, não em dois passos. Substitui as categorias
 * associadas em vez de diffar o que já existia: mais simples e
 * igualmente correto pro volume de categorias por trabalhador (poucas).
 * `bio`/`cpf` são opcionais aqui (quem já tem perfil pode editar outra
 * coisa sem reenviar os dois) — o cadastro inicial que exige CPF, no
 * cliente.
 */
export async function upsertWorkerProfile(
  userId: string,
  input: UpsertWorkerProfileInput,
): Promise<WorkerProfileResponse> {
  const fullName = input.fullName?.trim();
  const categoryIds = input.categoryIds;

  if (!fullName || fullName.length < 2) {
    throw new HttpError(400, 'Nome é obrigatório.');
  }

  if (!categoryIds || categoryIds.length === 0) {
    throw new HttpError(400, 'Escolha ao menos uma categoria.');
  }

  const validCategories = await db.query.skillCategories.findMany({
    where: inArray(skillCategories.id, categoryIds),
  });
  if (validCategories.length !== new Set(categoryIds).size) {
    throw new HttpError(400, 'Categoria inválida.');
  }

  const bio = input.bio?.trim();
  if (bio && bio.length > 500) {
    throw new HttpError(400, 'Bio muito longa — no máximo 500 caracteres.');
  }

  const cpf = input.cpf?.trim();
  if (cpf) {
    if (!CPF_REGEX.test(cpf)) {
      throw new HttpError(400, 'CPF inválido — envie só os 11 números.');
    }
    const cpfOwner = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.cpf, cpf) });
    if (cpfOwner && cpfOwner.userId !== userId) {
      throw new HttpError(400, 'Esse CPF já está cadastrado.');
    }
  }

  let photoUrl: string | undefined;
  if (input.photoUrl) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.googlePhotoUrl || user.googlePhotoUrl !== input.photoUrl) {
      throw new HttpError(400, 'Foto de perfil inválida.');
    }
    photoUrl = input.photoUrl;
  }

  const [profile] = await db
    .insert(workerProfiles)
    .values({ userId, fullName, photoUrl, bio: bio || null, cpf: cpf || null })
    .onConflictDoUpdate({
      target: workerProfiles.userId,
      // bio/cpf só entram no UPDATE quando enviados de verdade — editar
      // só o nome ou as categorias não pode apagar um bio/cpf já salvo.
      set: {
        fullName,
        updatedAt: new Date(),
        ...(photoUrl ? { photoUrl } : {}),
        ...(input.bio !== undefined ? { bio: bio || null } : {}),
        ...(input.cpf !== undefined ? { cpf: cpf || null } : {}),
      },
    })
    .returning();

  const existingSkills = await db.query.workerSkills.findMany({ where: eq(workerSkills.workerId, userId) });
  const existingExperienceByCategory = Object.fromEntries(
    existingSkills.map((skill) => [skill.categoryId, skill.hasExperience]),
  );

  await db.delete(workerSkills).where(eq(workerSkills.workerId, userId));
  await db.insert(workerSkills).values(
    categoryIds.map((categoryId) => ({
      workerId: userId,
      categoryId,
      hasExperience: input.experienceByCategory?.[categoryId] ?? existingExperienceByCategory[categoryId] ?? false,
    })),
  );

  const experienceByCategory = Object.fromEntries(
    categoryIds.map((categoryId) => [
      categoryId,
      input.experienceByCategory?.[categoryId] ?? existingExperienceByCategory[categoryId] ?? false,
    ]),
  );

  return {
    fullName,
    categoryIds,
    photoUrl: profile?.photoUrl ?? null,
    bio: profile?.bio ?? null,
    cpf: profile?.cpf ?? null,
    experienceByCategory,
  };
}
