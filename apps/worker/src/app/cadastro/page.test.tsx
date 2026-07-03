import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import CadastroPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listSkillCategoriesMock = vi.fn();
const upsertWorkerProfileMock = vi.fn();
vi.mock('../../lib/worker-profile-api', () => ({
  listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  upsertWorkerProfile: (...args: unknown[]) => upsertWorkerProfileMock(...args),
}));

const CATEGORIES = [
  { id: 'cat-1', name: 'Garçom' },
  { id: 'cat-2', name: 'Cozinha' },
];

describe('CadastroPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: CATEGORIES });
    upsertWorkerProfileMock.mockReset();
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

  it('começa com o botão desabilitado e habilita com nome + categoria', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.click(screen.getByLabelText('Garçom'));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();

    await user.click(screen.getByLabelText('Garçom'));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('salva o perfil e navega pra tela de documento', async () => {
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'] });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.click(screen.getByLabelText('Garçom'));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(upsertWorkerProfileMock).toHaveBeenCalledWith('Ana Souza', ['cat-1']);
  });

  it('mostra a mensagem da API quando salvar falha', async () => {
    upsertWorkerProfileMock.mockRejectedValue(new ApiError(400, 'Categoria inválida.'));
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.click(screen.getByLabelText('Garçom'));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Categoria inválida.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
