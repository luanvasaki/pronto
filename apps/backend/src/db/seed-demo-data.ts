import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db } from './client';
import { companies, jobs, users } from './schema';

/**
 * Popula o app com empresas e vagas de exemplo pra demonstração —
 * nunca aparecem diferentes pro trabalhador (mesmos campos, já
 * aprovadas, mesmo fluxo). Todas marcadas `isDemo: true`, pra dar pra
 * remover tudo de uma vez pelo botão em /admin ("Remover dados de
 * demonstração"). Rodar de novo depois de remover cria um lote novo —
 * não é idempotente de propósito, cada chamada é "quero mais exemplos".
 */
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

interface DemoJobInput {
  categoryName: string;
  description: string;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  payAmount: string;
  startsInHours: number;
  durationHours: number;
}

interface DemoCompanyInput {
  phone: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  jobs: DemoJobInput[];
}

const DEMO_COMPANIES: DemoCompanyInput[] = [
  {
    phone: '+5511900000101',
    legalName: 'Bar do Nonno Gastronomia Ltda',
    tradeName: 'Bar do Nonno',
    cnpj: '11444777000161',
    jobs: [
      {
        categoryName: 'Garçom',
        description: 'Atendimento de mesas em bar de bairro, movimento de sexta à noite. Uniforme fornecido.',
        addressLabel: 'Vila Madalena, São Paulo',
        locationLat: -23.5505,
        locationLng: -46.6906,
        positionsTotal: 2,
        payAmount: '130.00',
        startsInHours: 30,
        durationHours: 5,
      },
    ],
  },
  {
    phone: '+5511900000102',
    legalName: 'Cantina Real Buffets e Eventos Ltda',
    tradeName: 'Cantina Real',
    cnpj: '22555888000172',
    jobs: [
      {
        categoryName: 'Cozinha',
        description: 'Apoio de cozinha em evento de casamento, preparo e montagem de pratos frios.',
        addressLabel: 'Campolim, Sorocaba',
        locationLat: -23.4894,
        locationLng: -47.4619,
        positionsTotal: 1,
        payAmount: '140.00',
        startsInHours: 78,
        durationHours: 6,
      },
    ],
  },
  {
    phone: '+5511900000103',
    legalName: 'Aurora Produções e Eventos Ltda',
    tradeName: 'Eventos Aurora',
    cnpj: '33666999000183',
    jobs: [
      {
        categoryName: 'Segurança de evento',
        description: 'Segurança de portaria em show de música ao vivo, controle de acesso e revista.',
        addressLabel: 'Alto da Boa Vista, Sorocaba',
        locationLat: -23.4661,
        locationLng: -47.4547,
        positionsTotal: 2,
        payAmount: '165.00',
        startsInHours: 126,
        durationHours: 7,
      },
    ],
  },
  {
    phone: '+5511900000104',
    legalName: 'Sabor e Companhia Restaurante Ltda',
    tradeName: 'Restaurante Sabor & Cia',
    cnpj: '44777000000194',
    jobs: [
      {
        categoryName: 'Cozinha',
        description: 'Vaga pra reforço de cozinha no almoço executivo, experiência com alto volume.',
        addressLabel: 'Jardim Vergueiro, Sorocaba',
        locationLat: -23.5107,
        locationLng: -47.4479,
        positionsTotal: 1,
        payAmount: '125.00',
        startsInHours: 54,
        durationHours: 5,
      },
    ],
  },
  {
    phone: '+5511900000105',
    legalName: 'New Republic Entretenimento Ltda',
    tradeName: 'New Republic Club',
    cnpj: '55888111000205',
    jobs: [
      {
        categoryName: 'Garçom',
        description: 'Atendimento de bar em casa noturna, turno de pico sexta e sábado.',
        addressLabel: 'Itaim Bibi, São Paulo',
        locationLat: -23.5786,
        locationLng: -46.6779,
        positionsTotal: 3,
        payAmount: '150.00',
        startsInHours: 102,
        durationHours: 6,
      },
      {
        categoryName: 'Segurança de evento',
        description: 'Segurança de pista em casa noturna, experiência com público grande.',
        addressLabel: 'Itaim Bibi, São Paulo',
        locationLat: -23.5786,
        locationLng: -46.6779,
        positionsTotal: 2,
        payAmount: '170.00',
        startsInHours: 150,
        durationHours: 7,
      },
    ],
  },
];

async function seedDemoData(): Promise<void> {
  const categories = await db.query.skillCategories.findMany();
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));

  let companiesCreated = 0;
  let jobsCreated = 0;

  for (const demoCompany of DEMO_COMPANIES) {
    const existing = await db.query.companies.findFirst({ where: eq(companies.cnpj, demoCompany.cnpj) });
    if (existing) {
      console.log(`Empresa "${demoCompany.tradeName}" já existe (CNPJ ${demoCompany.cnpj}) — pulando.`);
      continue;
    }

    const [owner] = await db.insert(users).values({ phone: demoCompany.phone }).returning();
    if (!owner) {
      throw new Error(`Falha ao criar usuário dono da empresa demo "${demoCompany.tradeName}".`);
    }
    const [company] = await db
      .insert(companies)
      .values({
        ownerUserId: owner.id,
        legalName: demoCompany.legalName,
        tradeName: demoCompany.tradeName,
        cnpj: demoCompany.cnpj,
        verificationStatus: 'approved',
        isDemo: true,
      })
      .returning();
    if (!company) {
      throw new Error(`Falha ao criar empresa demo "${demoCompany.tradeName}".`);
    }
    companiesCreated += 1;

    for (const demoJob of demoCompany.jobs) {
      const categoryId = categoryIdByName.get(demoJob.categoryName);
      if (!categoryId) {
        console.warn(`Categoria "${demoJob.categoryName}" não encontrada — rode "npm run db:seed" antes. Pulando vaga.`);
        continue;
      }

      const startsAt = hoursFromNow(demoJob.startsInHours);
      const endsAt = hoursFromNow(demoJob.startsInHours + demoJob.durationHours);

      await db.insert(jobs).values({
        companyId: company.id,
        categoryId,
        description: demoJob.description,
        addressLabel: demoJob.addressLabel,
        locationLat: demoJob.locationLat,
        locationLng: demoJob.locationLng,
        positionsTotal: demoJob.positionsTotal,
        payAmount: demoJob.payAmount,
        startsAt,
        endsAt,
      });
      jobsCreated += 1;
    }
  }

  console.log(`Seed de demonstração concluído: ${companiesCreated} empresa(s), ${jobsCreated} vaga(s).`);
}

seedDemoData()
  .catch((error) => {
    console.error('Falha ao rodar o seed de demonstração:', error);
    process.exitCode = 1;
  })
  .finally(closeDb);
