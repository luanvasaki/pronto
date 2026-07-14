import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerProfileDetails } from '../../../lib/worker-profile-api';
import { WorkerProfileProvider } from '../worker-profile-context';
import PerfilPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listSkillCategoriesMock = vi.fn();
const logoutMock = vi.fn();
const createSkillCategoryMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
    createSkillCategory: (...args: unknown[]) => createSkillCategoryMock(...args),
  };
});

const uploadWorkerPhotoMock = vi.fn();
const upsertWorkerProfileMock = vi.fn();
const listWorkerRatingsMock = vi.fn();
vi.mock('../../../lib/worker-profile-api', () => ({
  uploadWorkerPhoto: (...args: unknown[]) => uploadWorkerPhotoMock(...args),
  upsertWorkerProfile: (...args: unknown[]) => upsertWorkerProfileMock(...args),
  listWorkerRatings: (...args: unknown[]) => listWorkerRatingsMock(...args),
}));

const CATEGORIES = [
  { id: 'cat-1', name: 'Garçom' },
  { id: 'cat-2', name: 'Cozinha' },
];

const BASE_PROFILE: WorkerProfileDetails = {
  fullName: 'Ana Souza',
  bio: null,
  cpf: null,
  categoryIds: ['cat-1'],
  experienceByCategory: {},
  photoUrl: null,
  homeAddressLabel: null,
  homeLat: null,
  homeLng: null,
  searchRadiusKm: 10,
  homeAddressFull: 'Rua das Flores, 123, Centro, São Paulo - SP',
  phone: '11912345678',
  birthDate: '2000-01-01',
  cnhCategory: null,
  kycStatus: 'approved',
  hasDocument: true,
  hasSelfie: true,
  hasCnhDocument: false,
  avgRating: '4.5',
  avgCategoryScores: { pontualidade: '4.7', educacao: '4.3' },
  totalShiftsCompleted: 3,
  totalHoursWorked: 12.5,
  companiesServed: 2,
  rehireRate: 50,
  attendanceRate: 90,
  cancellations: 1,
};

function renderWithProfile(profile: WorkerProfileDetails | null) {
  return render(
    <WorkerProfileProvider initialProfile={profile}>
      <PerfilPage />
    </WorkerProfileProvider>,
  );
}

describe('PerfilPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: CATEGORIES });
    logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
    uploadWorkerPhotoMock.mockReset();
    upsertWorkerProfileMock.mockReset();
    createSkillCategoryMock.mockReset();
    listWorkerRatingsMock.mockReset().mockResolvedValue({ ratings: [] });
  });

  it('mostra nome, selo de verificado e estatísticas', async () => {
    renderWithProfile(BASE_PROFILE);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Identidade verificada')).toBeInTheDocument();
    expect(screen.getByText('12.5h')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5')).toBeInTheDocument();
  });

  it('mostra os pontos fortes por categoria quando disponíveis', async () => {
    renderWithProfile(BASE_PROFILE);

    await screen.findByText('Ana Souza');
    expect(screen.getByText('Seus pontos fortes')).toBeInTheDocument();
    expect(screen.getByText('★ 4.7 Pontualidade')).toBeInTheDocument();
    expect(screen.getByText('★ 4.3 Educação e respeito')).toBeInTheDocument();
  });

  it('mostra o histórico com empresas atendidas, comparecimento, cancelamentos e recontratação', async () => {
    renderWithProfile(BASE_PROFILE);

    await screen.findByText('Ana Souza');
    expect(screen.getByText('Seu histórico')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('mostra travessão pra comparecimento e recontratação quando ainda não há dado', async () => {
    renderWithProfile({ ...BASE_PROFILE, attendanceRate: null, rehireRate: null });

    await screen.findByText('Ana Souza');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('mostra avaliações recebidas com empresa, nota, comentário e categorias', async () => {
    listWorkerRatingsMock.mockResolvedValue({
      ratings: [
        {
          id: 'rating-1',
          companyName: 'Bar do Zé',
          categoryId: 'cat-1',
          score: 5,
          categoryScores: { pontualidade: 5 },
          comment: 'Excelente profissional.',
          shiftDate: '2026-07-01T20:00:00.000Z',
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
    });

    renderWithProfile(BASE_PROFILE);

    expect(await screen.findByText('Avaliações recebidas')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
    expect(screen.getByText('★ 5')).toBeInTheDocument();
    expect(screen.getByText('"Excelente profissional."')).toBeInTheDocument();
    expect(screen.getByText('★5 Pontualidade')).toBeInTheDocument();
  });

  it('não mostra a seção de avaliações recebidas quando ainda não há nenhuma', async () => {
    renderWithProfile(BASE_PROFILE);

    await screen.findByText('Ana Souza');
    expect(screen.queryByText('Avaliações recebidas')).not.toBeInTheDocument();
  });

  it('não mostra a seção de pontos fortes sem avaliações por categoria ainda', async () => {
    renderWithProfile({ ...BASE_PROFILE, avgCategoryScores: null });

    await screen.findByText('Ana Souza');
    expect(screen.queryByText('Seus pontos fortes')).not.toBeInTheDocument();
  });

  it('mostra travessão quando ainda não tem nota', async () => {
    renderWithProfile({ ...BASE_PROFILE, kycStatus: 'pending', avgRating: null, totalHoursWorked: 0 });

    await screen.findByText('Ana Souza');
    expect(screen.getByText('Documento em análise')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('mostra mensagem quando o perfil não está disponível', () => {
    renderWithProfile(null);

    expect(screen.getByText('Perfil não encontrado.')).toBeInTheDocument();
  });

  it('mostra as categorias já escolhidas marcadas e as demais pra adicionar', async () => {
    renderWithProfile(BASE_PROFILE);

    expect(await screen.findByRole('button', { name: 'Garçom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Cozinha' })).toBeInTheDocument();
  });

  it('mostra o selo de experiência quando declarada pra categoria', async () => {
    renderWithProfile({ ...BASE_PROFILE, experienceByCategory: { 'cat-1': true } });

    expect(await screen.findByRole('button', { name: 'Garçom ✓' })).toBeInTheDocument();
  });

  it('marca experiência numa função selecionada', async () => {
    upsertWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1'],
      photoUrl: null,
      bio: null,
      cpf: null,
      experienceByCategory: { 'cat-1': true },
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.click(await screen.findByRole('button', { name: 'Experiência em Garçom' }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
        fullName: 'Ana Souza',
        categoryIds: ['cat-1'],
        experienceByCategory: { 'cat-1': true },
      }),
    );
  });

  it('desmarca experiência já declarada numa função', async () => {
    upsertWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1'],
      photoUrl: null,
      bio: null,
      cpf: null,
      experienceByCategory: { 'cat-1': false },
    });
    const user = userEvent.setup();
    renderWithProfile({ ...BASE_PROFILE, experienceByCategory: { 'cat-1': true } });

    await user.click(await screen.findByRole('button', { name: 'Experiência em Garçom' }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
        fullName: 'Ana Souza',
        categoryIds: ['cat-1'],
        experienceByCategory: { 'cat-1': false },
      }),
    );
  });

  it('não mostra o toggle de experiência pra funções não selecionadas', async () => {
    renderWithProfile(BASE_PROFILE);

    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: 'Experiência em Cozinha' })).not.toBeInTheDocument();
  });

  it('adiciona uma categoria ao clicar', async () => {
    upsertWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1', 'cat-2'],
      photoUrl: null,
      bio: null,
      cpf: null,
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.click(await screen.findByRole('button', { name: '+ Cozinha' }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
        fullName: 'Ana Souza',
        categoryIds: ['cat-1', 'cat-2'],
      }),
    );
    expect(await screen.findByRole('button', { name: 'Cozinha' })).toBeInTheDocument();
  });

  it('não deixa remover a última categoria', async () => {
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.click(await screen.findByRole('button', { name: 'Garçom' }));

    expect(await screen.findByText('Você precisa ter ao menos uma categoria.')).toBeInTheDocument();
    expect(upsertWorkerProfileMock).not.toHaveBeenCalled();
  });

  it('envia a foto escolhida', async () => {
    uploadWorkerPhotoMock.mockResolvedValue({ photoUrl: '/uploads/public/foto.jpg' });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await screen.findByText('Ana Souza');
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => expect(uploadWorkerPhotoMock).toHaveBeenCalledWith(file));
  });

  it('salva nome, bio e CPF editados', async () => {
    upsertWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza Lima',
      categoryIds: ['cat-1'],
      photoUrl: null,
      bio: 'Garçonete com experiência em eventos.',
      cpf: '11122233344',
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    const nameInput = await screen.findByLabelText('Nome completo');
    await user.clear(nameInput);
    await user.type(nameInput, 'Ana Souza Lima');
    await user.type(screen.getByLabelText(/sobre mim/i), 'Garçonete com experiência em eventos.');
    await user.type(screen.getByLabelText('CPF'), '11122233344');
    await user.click(screen.getByRole('button', { name: /salvar perfil/i }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
        fullName: 'Ana Souza Lima',
        categoryIds: ['cat-1'],
        bio: 'Garçonete com experiência em eventos.',
        cpf: '11122233344',
        phone: '11912345678',
        homeAddressFull: 'Rua das Flores, 123, Centro, São Paulo - SP',
        cnhCategory: '',
      }),
    );
    expect(await screen.findByText('Perfil salvo.')).toBeInTheDocument();
  });

  it('mostra o que falta preencher quando o perfil (ex.: de antes do telefone virar obrigatório) não tem telefone', async () => {
    renderWithProfile({ ...BASE_PROFILE, phone: null });

    await screen.findByRole('heading', { name: 'Editar perfil' });

    expect(screen.getByText('Falta preencher: telefone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perfil/i })).toBeDisabled();
  });

  it('salva a categoria de CNH escolhida', async () => {
    upsertWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1'],
      photoUrl: null,
      bio: null,
      cpf: null,
      homeAddressFull: 'Rua das Flores, 123, Centro, São Paulo - SP',
      cnhCategory: 'AB',
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await screen.findByText('Ana Souza');
    await user.selectOptions(screen.getByLabelText(/categoria da cnh/i), 'AB');
    await user.click(screen.getByRole('button', { name: /salvar perfil/i }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({ cnhCategory: 'AB' }),
      ),
    );
  });

  it('cria uma categoria nova, marca ela e salva o perfil', async () => {
    createSkillCategoryMock.mockResolvedValue({ id: 'cat-new', name: 'Manobrista' });
    upsertWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1', 'cat-new'],
      photoUrl: null,
      bio: null,
      cpf: null,
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.click(await screen.findByRole('button', { name: '+ Criar categoria' }));
    await user.type(screen.getByLabelText(/nome da nova categoria/i), 'Manobrista');
    await user.click(screen.getByRole('button', { name: /^adicionar$/i }));

    await waitFor(() => expect(createSkillCategoryMock).toHaveBeenCalledWith('Manobrista'));
    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
        fullName: 'Ana Souza',
        categoryIds: ['cat-1', 'cat-new'],
      }),
    );
    expect(await screen.findByRole('button', { name: 'Manobrista' })).toBeInTheDocument();
  });

  it('chama logout e navega pro login ao clicar em "Sair da conta"', async () => {
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    const logoutButton = await screen.findByRole('button', { name: /sair da conta/i });
    await user.click(logoutButton);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/entrar'));
    expect(logoutMock).toHaveBeenCalled();
  });
});
