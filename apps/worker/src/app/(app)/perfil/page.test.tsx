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
vi.mock('../../../lib/worker-profile-api', () => ({
  uploadWorkerPhoto: (...args: unknown[]) => uploadWorkerPhotoMock(...args),
  upsertWorkerProfile: (...args: unknown[]) => upsertWorkerProfileMock(...args),
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
  kycStatus: 'approved',
  hasDocument: true,
  avgRating: '4.5',
  totalShiftsCompleted: 3,
  totalHoursWorked: 12.5,
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
  });

  it('mostra nome, selo de verificado e estatísticas', async () => {
    renderWithProfile(BASE_PROFILE);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Identidade verificada')).toBeInTheDocument();
    expect(screen.getByText('12.5h')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5')).toBeInTheDocument();
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
      }),
    );
    expect(await screen.findByText('Perfil salvo.')).toBeInTheDocument();
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
