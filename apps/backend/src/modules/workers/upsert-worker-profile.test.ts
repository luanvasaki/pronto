import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { skillCategories, users, workerSkills } from '../../db/schema';
import { upsertWorkerProfile } from './upsert-worker-profile';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511966660001';
const OTHER_PHONE = '+5511966660071';
const CATEGORY_A = 'Categoria de teste — upsert A';
const CATEGORY_B = 'Categoria de teste — upsert B';
const TEST_CPF = '11122233396';
const OTHER_CPF = '55566677720';
const TEST_ADDRESS = 'Rua das Flores, 123, Centro, São Paulo - SP';
const TEST_WORKER_PHONE = '11912345678';
const TEST_BIRTH_DATE = '2000-01-01';

// Evita usar toISOString() aqui: ele converte pra UTC, o que pode
// empurrar a data pro dia seguinte dependendo do fuso da máquina que
// roda o teste — exatamente o tipo de off-by-one que faria o teste do
// aniversário de hoje falhar de forma não determinística.
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function createTestUser() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  return user;
}

describe('upsertWorkerProfile', () => {
  afterEach(async () => {
    // Usuário primeiro (cascade limpa worker_profiles/worker_skills),
    // categoria depois — ver nota de ordem no teste de worker_skills.
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(users).where(eq(users.phone, OTHER_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_A));
    await db.delete(skillCategories).where(eq(skillCategories.name, CATEGORY_B));
  });

  it('rejeita nome ausente', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, { fullName: undefined, categoryIds: ['x'], photoUrl: undefined }),
    ).rejects.toThrow('Nome é obrigatório');
  });

  it('rejeita photoUrl que não é a foto do Google do próprio usuário', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        photoUrl: 'https://attacker.example.com/foto.jpg',
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: TEST_BIRTH_DATE,
      }),
    ).rejects.toThrow('Foto de perfil inválida');
  });

  it('aceita photoUrl igual ao googlePhotoUrl do usuário', async () => {
    const googlePhotoUrl = 'https://lh3.googleusercontent.com/a/foto-teste';
    const [user] = await db
      .insert(users)
      .values({ phone: TEST_PHONE, googlePhotoUrl })
      .returning();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      photoUrl: googlePhotoUrl,
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    expect(result.photoUrl).toBe(googlePhotoUrl);
  });

  it('rejeita lista de categorias vazia', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [] }),
    ).rejects.toThrow('Escolha ao menos uma categoria');
  });

  it('rejeita categoria que não existe', async () => {
    const user = await createTestUser();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toThrow('Categoria inválida');
  });

  it('rejeita CPF ausente no cadastro inicial', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id] }),
    ).rejects.toThrow('CPF é obrigatório');
  });

  it('rejeita endereço completo ausente no cadastro inicial', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id], cpf: TEST_CPF }),
    ).rejects.toThrow('Endereço completo é obrigatório');
  });

  it('rejeita telefone ausente no cadastro inicial', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
      }),
    ).rejects.toThrow('Telefone é obrigatório');
  });

  it('rejeita telefone com formato inválido', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: '123',
      }),
    ).rejects.toThrow('Telefone inválido');
  });

  it('rejeita data de nascimento ausente no cadastro inicial', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
      }),
    ).rejects.toThrow('Data de nascimento é obrigatória');
  });

  it('rejeita data de nascimento com formato inválido', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: '01/01/2000',
      }),
    ).rejects.toThrow('Data de nascimento inválida');
  });

  it('rejeita trabalhador menor de 16 anos', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const fifteenYearsAgo = new Date();
    fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);
    const birthDate = toDateString(fifteenYearsAgo);

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate,
      }),
    ).rejects.toThrow('16 anos ou mais');
  });

  describe('trabalhador entre 16 e 17 anos (exige dados do responsável)', () => {
    function seventeenYearsAgoBirthDate(): string {
      const seventeenYearsAgo = new Date();
      seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
      return toDateString(seventeenYearsAgo);
    }

    it('rejeita sem nome do responsável', async () => {
      const user = await createTestUser();
      const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

      await expect(
        upsertWorkerProfile(user.id, {
          fullName: 'Ana Souza',
          categoryIds: [category.id],
          cpf: TEST_CPF,
          homeAddressFull: TEST_ADDRESS,
          phone: TEST_WORKER_PHONE,
          birthDate: seventeenYearsAgoBirthDate(),
          guardianCpf: TEST_CPF,
          guardianPhone: TEST_WORKER_PHONE,
          guardianAuthorized: true,
        }),
      ).rejects.toThrow('Nome do responsável é obrigatório');
    });

    it('rejeita sem CPF do responsável', async () => {
      const user = await createTestUser();
      const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

      await expect(
        upsertWorkerProfile(user.id, {
          fullName: 'Ana Souza',
          categoryIds: [category.id],
          cpf: TEST_CPF,
          homeAddressFull: TEST_ADDRESS,
          phone: TEST_WORKER_PHONE,
          birthDate: seventeenYearsAgoBirthDate(),
          guardianFullName: 'Marcos Souza',
          guardianPhone: TEST_WORKER_PHONE,
          guardianAuthorized: true,
        }),
      ).rejects.toThrow('CPF do responsável é obrigatório');
    });

    it('rejeita sem telefone do responsável', async () => {
      const user = await createTestUser();
      const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

      await expect(
        upsertWorkerProfile(user.id, {
          fullName: 'Ana Souza',
          categoryIds: [category.id],
          cpf: TEST_CPF,
          homeAddressFull: TEST_ADDRESS,
          phone: TEST_WORKER_PHONE,
          birthDate: seventeenYearsAgoBirthDate(),
          guardianFullName: 'Marcos Souza',
          guardianCpf: OTHER_CPF,
          guardianAuthorized: true,
        }),
      ).rejects.toThrow('Telefone do responsável é obrigatório');
    });

    it('rejeita sem a autorização explícita do responsável', async () => {
      const user = await createTestUser();
      const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

      await expect(
        upsertWorkerProfile(user.id, {
          fullName: 'Ana Souza',
          categoryIds: [category.id],
          cpf: TEST_CPF,
          homeAddressFull: TEST_ADDRESS,
          phone: TEST_WORKER_PHONE,
          birthDate: seventeenYearsAgoBirthDate(),
          guardianFullName: 'Marcos Souza',
          guardianCpf: OTHER_CPF,
          guardianPhone: TEST_WORKER_PHONE,
          guardianAuthorized: false,
        }),
      ).rejects.toThrow('autoriza o cadastro');
    });

    it('rejeita CPF do responsável com dígito verificador inválido', async () => {
      const user = await createTestUser();
      const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

      await expect(
        upsertWorkerProfile(user.id, {
          fullName: 'Ana Souza',
          categoryIds: [category.id],
          cpf: TEST_CPF,
          homeAddressFull: TEST_ADDRESS,
          phone: TEST_WORKER_PHONE,
          birthDate: seventeenYearsAgoBirthDate(),
          guardianFullName: 'Marcos Souza',
          guardianCpf: '11111111111',
          guardianPhone: TEST_WORKER_PHONE,
          guardianAuthorized: true,
        }),
      ).rejects.toThrow('CPF do responsável inválido');
    });

    it('salva os dados do responsável e cria o perfil normalmente', async () => {
      const user = await createTestUser();
      const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
      const birthDate = seventeenYearsAgoBirthDate();

      const result = await upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate,
        guardianFullName: 'Marcos Souza',
        guardianCpf: OTHER_CPF,
        guardianPhone: '11988887777',
        guardianAuthorized: true,
      });

      expect(result.birthDate).toBe(birthDate);
      expect(result.guardianFullName).toBe('Marcos Souza');
      expect(result.guardianCpf).toBe(OTHER_CPF);
      expect(result.guardianPhone).toBe('11988887777');
      expect(result.guardianAuthorizedAt).not.toBeNull();
    });
  });

  it('não guarda dados do responsável quando o trabalhador é maior de idade (mesmo se enviados)', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
      guardianFullName: 'Não devia salvar',
      guardianCpf: OTHER_CPF,
      guardianPhone: TEST_WORKER_PHONE,
      guardianAuthorized: true,
    });

    expect(result.guardianFullName).toBeNull();
    expect(result.guardianCpf).toBeNull();
    expect(result.guardianPhone).toBeNull();
    expect(result.guardianAuthorizedAt).toBeNull();
  });

  it('aceita trabalhador que completa 18 anos exatamente hoje', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const eighteenYearsAgoToday = new Date();
    eighteenYearsAgoToday.setFullYear(eighteenYearsAgoToday.getFullYear() - 18);
    const birthDate = toDateString(eighteenYearsAgoToday);

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate,
    });

    expect(result.birthDate).toBe(birthDate);
  });

  it('preserva data de nascimento já salva quando uma atualização posterior não a reenvia', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    const updated = await upsertWorkerProfile(user.id, { fullName: 'Ana Souza Lima', categoryIds: [category.id] });

    expect(updated.birthDate).toBe(TEST_BIRTH_DATE);
  });

  it('cria o perfil com as categorias associadas', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: '  Ana Souza  ',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    expect(result.fullName).toBe('Ana Souza');
    const skills = await db.query.workerSkills.findMany({
      where: eq(workerSkills.workerId, user.id),
    });
    expect(skills).toHaveLength(1);
  });

  it('atualiza o nome e substitui as categorias numa segunda chamada', async () => {
    const user = await createTestUser();
    const [categoryA] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const [categoryB] = await db.insert(skillCategories).values({ name: CATEGORY_B }).returning();

    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });
    const updated = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza Lima',
      categoryIds: [categoryB.id],
    });

    expect(updated.fullName).toBe('Ana Souza Lima');
    const skills = await db.query.workerSkills.findMany({
      where: eq(workerSkills.workerId, user.id),
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].categoryId).toBe(categoryB.id);
  });

  it('salva bio e CPF quando informados', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      bio: 'Garçonete com 5 anos de experiência em eventos.',
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    expect(result.bio).toBe('Garçonete com 5 anos de experiência em eventos.');
    expect(result.cpf).toBe(TEST_CPF);
    expect(result.homeAddressFull).toBe(TEST_ADDRESS);
    expect(result.phone).toBe(TEST_WORKER_PHONE);
  });

  it('rejeita CPF com formato inválido', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id], cpf: '123' }),
    ).rejects.toThrow('CPF inválido');
  });

  it('rejeita CPF com 11 dígitos mas dígito verificador inválido', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id], cpf: '11111111111' }),
    ).rejects.toThrow('CPF inválido');
  });

  it('rejeita CPF já usado por outro trabalhador', async () => {
    const user = await createTestUser();
    const [otherUser] = await db.insert(users).values({ phone: OTHER_PHONE }).returning();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    await upsertWorkerProfile(otherUser.id, {
      fullName: 'Outra Pessoa',
      categoryIds: [category.id],
      cpf: OTHER_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    await expect(
      upsertWorkerProfile(user.id, { fullName: 'Ana Souza', categoryIds: [category.id], cpf: OTHER_CPF }),
    ).rejects.toThrow('Esse CPF já está cadastrado');
  });

  it('preserva bio e CPF já salvos quando uma atualização posterior não os reenvia', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      bio: 'Bio original.',
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    const updated = await upsertWorkerProfile(user.id, { fullName: 'Ana Souza Lima', categoryIds: [category.id] });

    expect(updated.fullName).toBe('Ana Souza Lima');
    expect(updated.bio).toBe('Bio original.');
    expect(updated.cpf).toBe(TEST_CPF);
    expect(updated.homeAddressFull).toBe(TEST_ADDRESS);
    expect(updated.phone).toBe(TEST_WORKER_PHONE);
  });

  it('salva a experiência declarada por categoria', async () => {
    const user = await createTestUser();
    const [categoryA] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const [categoryB] = await db.insert(skillCategories).values({ name: CATEGORY_B }).returning();

    const result = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id, categoryB.id],
      experienceByCategory: { [categoryA.id]: true, [categoryB.id]: false },
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    expect(result.experienceByCategory[categoryA.id]).toBe(true);
    expect(result.experienceByCategory[categoryB.id]).toBe(false);
    const skillA = await db.query.workerSkills.findFirst({
      where: eq(workerSkills.categoryId, categoryA.id),
    });
    expect(skillA?.hasExperience).toBe(true);
  });

  it('preserva a experiência já declarada quando uma atualização posterior não a reenvia', async () => {
    const user = await createTestUser();
    const [categoryA] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();
    const [categoryB] = await db.insert(skillCategories).values({ name: CATEGORY_B }).returning();
    await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id],
      experienceByCategory: { [categoryA.id]: true },
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
    });

    // Adiciona categoryB sem reenviar experienceByCategory — igual ao
    // que a tela de perfil faz ao só ligar/desligar um chip.
    const updated = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [categoryA.id, categoryB.id],
    });

    expect(updated.experienceByCategory[categoryA.id]).toBe(true);
    expect(updated.experienceByCategory[categoryB.id]).toBe(false);
  });

  it('rejeita categoria de CNH inválida', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    await expect(
      upsertWorkerProfile(user.id, {
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: TEST_BIRTH_DATE,
        cnhCategory: 'Z',
      }),
    ).rejects.toThrow('Categoria de CNH inválida');
  });

  it('salva e preserva a categoria de CNH', async () => {
    const user = await createTestUser();
    const [category] = await db.insert(skillCategories).values({ name: CATEGORY_A }).returning();

    const created = await upsertWorkerProfile(user.id, {
      fullName: 'Ana Souza',
      categoryIds: [category.id],
      cpf: TEST_CPF,
      homeAddressFull: TEST_ADDRESS,
      phone: TEST_WORKER_PHONE,
      birthDate: TEST_BIRTH_DATE,
      cnhCategory: 'AB',
    });
    expect(created.cnhCategory).toBe('AB');

    const updated = await upsertWorkerProfile(user.id, { fullName: 'Ana Souza Lima', categoryIds: [category.id] });
    expect(updated.cnhCategory).toBe('AB');
  });
});
