import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import CadastroPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listSkillCategoriesMock = vi.fn();
const getCurrentUserMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  };
});

const upsertWorkerProfileMock = vi.fn();
const uploadWorkerPhotoMock = vi.fn();
vi.mock('../../lib/worker-profile-api', () => ({
  upsertWorkerProfile: (...args: unknown[]) => upsertWorkerProfileMock(...args),
  uploadWorkerPhoto: (...args: unknown[]) => uploadWorkerPhotoMock(...args),
}));

const CATEGORIES = [
  { id: 'cat-1', name: 'Garçom' },
  { id: 'cat-2', name: 'Cozinha' },
];

const NO_GOOGLE_PHOTO_USER = { id: 'u1', email: 'ana@example.com', status: 'active', isAdmin: false, googlePhotoUrl: null };

describe('CadastroPage', () => {
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    pushMock.mockClear();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: CATEGORIES });
    getCurrentUserMock.mockReset().mockResolvedValue({ user: NO_GOOGLE_PHOTO_USER });
    upsertWorkerProfileMock.mockReset();
    uploadWorkerPhotoMock.mockReset();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('carrega e mostra as categorias', async () => {
    render(<CadastroPage />);

    expect(await screen.findByLabelText('Garçom')).toBeInTheDocument();
    expect(screen.getByLabelText('Cozinha')).toBeInTheDocument();
  });

  it('mostra erro quando as categorias falham ao carregar', async () => {
    listSkillCategoriesMock.mockReset().mockRejectedValue(new Error('falha'));

    render(<CadastroPage />);

    expect(await screen.findByText('Não foi possível carregar as categorias.')).toBeInTheDocument();
  });

  it('começa com o botão desabilitado e só habilita com nome + categoria + foto', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.click(screen.getByLabelText('Garçom'));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
  });

  it('pré-seleciona a foto do Google quando disponível, sem forçar upload', async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { ...NO_GOOGLE_PHOTO_USER, googlePhotoUrl: 'https://lh3.googleusercontent.com/foto' },
    });
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');
    await screen.findByText(/trocar foto/i);

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.click(screen.getByLabelText('Garçom'));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(upsertWorkerProfileMock).toHaveBeenCalledWith(
      'Ana Souza',
      ['cat-1'],
      'https://lh3.googleusercontent.com/foto',
    );
    expect(uploadWorkerPhotoMock).not.toHaveBeenCalled();
  });

  it('salva o perfil, envia a foto escolhida e navega pra tela de documento', async () => {
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
    uploadWorkerPhotoMock.mockResolvedValue({ photoUrl: '/uploads/public/foto.jpg' });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.click(screen.getByLabelText('Garçom'));
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(upsertWorkerProfileMock).toHaveBeenCalledWith('Ana Souza', ['cat-1'], undefined);
    expect(uploadWorkerPhotoMock).toHaveBeenCalledWith(file);
  });

  it('mostra a mensagem da API quando salvar falha', async () => {
    upsertWorkerProfileMock.mockRejectedValue(new ApiError(400, 'Categoria inválida.'));
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.click(screen.getByLabelText('Garçom'));
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Categoria inválida.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
