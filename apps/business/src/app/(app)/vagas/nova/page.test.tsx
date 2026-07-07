import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NovaVagaPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const createJobMock = vi.fn();
vi.mock('../../../../lib/jobs-api', () => ({
  createJob: (...args: unknown[]) => createJobMock(...args),
}));

function toDateTimeLocal(date: Date): string {
  return date.toISOString().slice(0, 16);
}

const STARTS_AT = toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
const ENDS_AT = toDateTimeLocal(new Date(Date.now() + 29 * 60 * 60 * 1000));

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Categoria'), 'cat-1');
  await user.type(screen.getByLabelText('Descrição'), 'Uniforme preto, experiência em eventos.');
  await user.type(screen.getByLabelText('Endereço'), 'Vila Madalena, São Paulo');
  await user.click(screen.getByRole('button', { name: /usar minha localização atual/i }));
  await screen.findByText('Localização definida ✓');
  await user.clear(screen.getByLabelText('Número de vagas'));
  await user.type(screen.getByLabelText('Número de vagas'), '4');
  await user.type(screen.getByLabelText('Valor por pessoa (R$)'), '130.00');
  await user.type(screen.getByLabelText('Início'), STARTS_AT);
  await user.type(screen.getByLabelText('Término'), ENDS_AT);
}

describe('NovaVagaPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    createJobMock.mockReset();
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -23.55, longitude: -46.63 } })),
      },
      configurable: true,
    });
  });

  it('começa com o botão desabilitado', async () => {
    render(<NovaVagaPage />);

    await screen.findByText('Garçom');
    expect(screen.getByRole('button', { name: /^publicar$/i })).toBeDisabled();
  });

  it('habilita o botão quando o formulário fica completo e válido', async () => {
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);

    expect(screen.getByRole('button', { name: /^publicar$/i })).toBeEnabled();
  });

  it('publica a vaga e navega pro painel quando a API responde bem', async () => {
    createJobMock.mockResolvedValue({ id: 'job-1', status: 'open' });
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /^publicar$/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
    expect(createJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1', positionsTotal: 4, payAmount: '130.00' }),
    );
  });

  it('mostra a mensagem da API quando publicar falha', async () => {
    createJobMock.mockRejectedValue(new ApiError(400, 'Data de início precisa ser no futuro.'));
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /^publicar$/i }));

    expect(await screen.findByText('Data de início precisa ser no futuro.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
