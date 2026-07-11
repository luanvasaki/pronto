import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { skillCategories, users, workerProfiles, workerSkills } from '../../db/schema';
import { CnhCategory, isCnhCategory } from '../jobs/cnh';
import { HttpError } from '../../shared/errors/http-error';

const CPF_REGEX = /^\d{11}$/;
const PHONE_REGEX = /^\d{10,11}$/;

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
  // Dado sensível — nunca retornado pra empresa, ver comentário do
  // schema. Igual ao CPF, obrigatório só no cadastro inicial.
  homeAddressFull: string | undefined;
  // Telefone de contato — mesma regra de privacidade e obrigatoriedade
  // do endereço completo (ver comentário do schema).
  phone: string | undefined;
  // Categoria de CNH do trabalhador — opcional (nem todo mundo tem
  // carteira), string vazia limpa um valor já salvo. Usada só pra bater
  // com o requisito de CNH de uma vaga (ver jobs/cnh.ts).
  cnhCategory: string | undefined;
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
  homeAddressFull: string | null;
  phone: string | null;
  cnhCategory: string | null;
  experienceByCategory: Record<string, boolean>;
}

/**
 * Cria ou atualiza numa chamada só — a tela de cadastro manda nome +
 * categorias juntos, não em dois passos. Substitui as categorias
 * associadas em vez de diffar o que já existia: mais simples e
 * igualmente correto pro volume de categorias por trabalhador (poucas).
 * `bio`/`cpf`/`homeAddressFull`/`phone` são opcionais aqui pra quem já
 * tem perfil (editar outra coisa sem reenviá-los preserva o valor
 * salvo) — mas CPF, endereço completo e telefone são exigidos quando
 * ainda não existe perfil (cadastro inicial), pra não dar pra criar um
 * perfil sem eles só pulando a validação do cliente.
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

  const existingProfile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, userId) });

  const cpf = input.cpf?.trim();
  // CPF é obrigatório só no cadastro inicial (perfil ainda não existe) —
  // depois disso, editar outra coisa sem reenviá-lo preserva o valor
  // salvo (ver comentário da interface). Repetido aqui no servidor
  // porque a exigência do cliente sozinha não impede um POST direto.
  if (!existingProfile && !cpf) {
    throw new HttpError(400, 'CPF é obrigatório.');
  }
  if (cpf) {
    if (!CPF_REGEX.test(cpf)) {
      throw new HttpError(400, 'CPF inválido — envie só os 11 números.');
    }
    const cpfOwner = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.cpf, cpf) });
    if (cpfOwner && cpfOwner.userId !== userId) {
      throw new HttpError(400, 'Esse CPF já está cadastrado.');
    }
  }

  const homeAddressFull = input.homeAddressFull?.trim();
  // Mesma regra do CPF: obrigatório só quando ainda não existe perfil.
  if (!existingProfile && !homeAddressFull) {
    throw new HttpError(400, 'Endereço completo é obrigatório.');
  }
  if (homeAddressFull && homeAddressFull.length < 8) {
    throw new HttpError(400, 'Endereço incompleto.');
  }

  const phone = input.phone?.trim();
  // Mesma regra do CPF/endereço: obrigatório só quando ainda não existe perfil.
  if (!existingProfile && !phone) {
    throw new HttpError(400, 'Telefone é obrigatório.');
  }
  if (phone && !PHONE_REGEX.test(phone)) {
    throw new HttpError(400, 'Telefone inválido — envie só os números, com DDD.');
  }

  const rawCnhCategory = input.cnhCategory?.trim();
  if (rawCnhCategory && !isCnhCategory(rawCnhCategory)) {
    throw new HttpError(400, 'Categoria de CNH inválida.');
  }
  const cnhCategory: CnhCategory | null = rawCnhCategory && isCnhCategory(rawCnhCategory) ? rawCnhCategory : null;

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
    .values({
      userId,
      fullName,
      photoUrl,
      bio: bio || null,
      cpf: cpf || null,
      homeAddressFull: homeAddressFull || null,
      phone: phone || null,
      cnhCategory,
    })
    .onConflictDoUpdate({
      target: workerProfiles.userId,
      // bio/cpf/homeAddressFull/phone/cnhCategory só entram no UPDATE
      // quando enviados de verdade — editar só o nome ou as categorias
      // não pode apagar valor já salvo.
      set: {
        fullName,
        updatedAt: new Date(),
        ...(photoUrl ? { photoUrl } : {}),
        ...(input.bio !== undefined ? { bio: bio || null } : {}),
        ...(input.cpf !== undefined ? { cpf: cpf || null } : {}),
        ...(input.homeAddressFull !== undefined ? { homeAddressFull: homeAddressFull || null } : {}),
        ...(input.phone !== undefined ? { phone: phone || null } : {}),
        ...(input.cnhCategory !== undefined ? { cnhCategory } : {}),
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
    homeAddressFull: profile?.homeAddressFull ?? null,
    phone: profile?.phone ?? null,
    cnhCategory: profile?.cnhCategory ?? null,
    experienceByCategory,
  };
}
