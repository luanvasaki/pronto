import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NovaVagaPage from './page';

const pushMock = vi.fn();
let searchParamsMock = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => searchParamsMock,
}));

const listSkillCategoriesMock = vi.fn();
const createSkillCategoryMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
    createSkillCategory: (...args: unknown[]) => createSkillCategoryMock(...args),
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
  await user.click(screen.getByRole('button', { name: 'Não' }));
  await user.type(screen.getByLabelText('Descrição'), 'Detalhes adicionais sobre o turno.');
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
    searchParamsMock = new URLSearchParams();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    createJobMock.mockReset();
    createSkillCategoryMock.mockReset();
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

  it('pré-preenche o início com a data vinda da Escala (?data=)', async () => {
    searchParamsMock = new URLSearchParams({ data: '2026-08-15' });
    render(<NovaVagaPage />);

    await screen.findByText('Garçom');
    expect(screen.getByLabelText('Início')).toHaveValue('2026-08-15T18:00');
  });

  it('ignora um ?data= em formato inválido', async () => {
    searchParamsMock = new URLSearchParams({ data: 'não-é-uma-data' });
    render(<NovaVagaPage />);

    await screen.findByText('Garçom');
    expect(screen.getByLabelText('Início')).toHaveValue('');
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

  it('envia experiência, vestimenta e ferramentas exigidas', async () => {
    createJobMock.mockResolvedValue({ id: 'job-1', status: 'open' });
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Sim' }));
    await user.type(screen.getByLabelText(/vestimenta exigida/i), 'Social completo');
    await user.type(screen.getByLabelText(/ferramentas que o profissional precisa levar/i), 'Câmera própria');
    await user.click(screen.getByRole('button', { name: /^publicar$/i }));

    await waitFor(() =>
      expect(createJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresExperience: true,
          dressCode: 'Social completo',
          toolsRequired: 'Câmera própria',
        }),
      ),
    );
  });

  it('cria uma categoria nova e usa o id retornado na vaga', async () => {
    createSkillCategoryMock.mockResolvedValue({ id: 'cat-new', name: 'Manobrista' });
    createJobMock.mockResolvedValue({ id: 'job-1', status: 'open' });
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await user.selectOptions(screen.getByLabelText('Categoria'), '__new__');
    await user.type(screen.getByLabelText(/nome da nova categoria/i), 'Manobrista');
    await user.click(screen.getByRole('button', { name: 'Não' }));
    await user.type(screen.getByLabelText('Descrição'), 'Detalhes adicionais sobre o turno.');
    await user.type(screen.getByLabelText('Endereço'), 'Vila Madalena, São Paulo');
    await user.click(screen.getByRole('button', { name: /usar minha localização atual/i }));
    await screen.findByText('Localização definida ✓');
    await user.clear(screen.getByLabelText('Número de vagas'));
    await user.type(screen.getByLabelText('Número de vagas'), '4');
    await user.type(screen.getByLabelText('Valor por pessoa (R$)'), '130.00');
    await user.type(screen.getByLabelText('Início'), STARTS_AT);
    await user.type(screen.getByLabelText('Término'), ENDS_AT);
    await user.click(screen.getByRole('button', { name: /^publicar$/i }));

    await waitFor(() => expect(createSkillCategoryMock).toHaveBeenCalledWith('Manobrista'));
    await waitFor(() =>
      expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-new' })),
    );
  });

  it('publica sem applicationsCloseAt quando o campo é deixado em branco (usa o padrão do backend)', async () => {
    createJobMock.mockResolvedValue({ id: 'job-1', status: 'open' });
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /^publicar$/i }));

    await waitFor(() =>
      expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({ applicationsCloseAt: undefined })),
    );
  });

  it('envia o applicationsCloseAt escolhido pela empresa', async () => {
    createJobMock.mockResolvedValue({ id: 'job-1', status: 'open' });
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);
    const closeAt = toDateTimeLocal(new Date(Date.now() + 20 * 60 * 60 * 1000));
    await user.type(screen.getByLabelText(/fechar candidaturas em/i), closeAt);
    await user.click(screen.getByRole('button', { name: /^publicar$/i }));

    await waitFor(() =>
      expect(createJobMock).toHaveBeenCalledWith(
        expect.objectContaining({ applicationsCloseAt: new Date(closeAt).toISOString() }),
      ),
    );
  });

  it('desabilita o botão quando o prazo de candidatura é depois do início', async () => {
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await fillValidForm(user);
    const afterStart = toDateTimeLocal(new Date(Date.now() + 30 * 60 * 60 * 1000));
    await user.type(screen.getByLabelText(/fechar candidaturas em/i), afterStart);

    expect(screen.getByText('Precisa ser até o horário de início do turno.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^publicar$/i })).toBeDisabled();
  });

  it('mostra erro quando a localização falha', async () => {
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn((_success, failure) => failure()) },
      configurable: true,
    });
    const user = userEvent.setup();
    render(<NovaVagaPage />);
    await screen.findByText('Garçom');

    await user.click(screen.getByRole('button', { name: /usar minha localização atual/i }));

    expect(await screen.findByText('Não foi possível obter sua localização.')).toBeInTheDocument();
  });
});
