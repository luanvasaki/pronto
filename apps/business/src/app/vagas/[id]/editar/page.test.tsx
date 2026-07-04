import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditarVagaPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'job-1' }),
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

const listMyJobsMock = vi.fn();
const updateJobMock = vi.fn();
vi.mock('../../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
  updateJob: (...args: unknown[]) => updateJobMock(...args),
}));

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom pra evento',
  addressLabel: 'Vila Madalena, São Paulo',
  locationLat: -23.55,
  locationLng: -46.63,
  positionsTotal: 4,
  positionsFilled: 1,
  payAmount: '130.00',
  startsAt: '2026-08-01T18:00:00.000Z',
  endsAt: '2026-08-01T23:00:00.000Z',
  status: 'open',
};

describe('EditarVagaPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyJobsMock.mockReset();
    updateJobMock.mockReset();
    pushMock.mockReset();
  });

  it('pré-preenche o formulário com os dados atuais da vaga', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });

    render(<EditarVagaPage />);

    expect(await screen.findByDisplayValue('Vaga de garçom pra evento')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Vila Madalena, São Paulo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('130.00')).toBeInTheDocument();
  });

  it('mostra erro quando a vaga não é encontrada', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<EditarVagaPage />);

    expect(await screen.findByText('Vaga não encontrada.')).toBeInTheDocument();
  });

  it('mostra erro quando a vaga não está mais aberta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled' }] });

    render(<EditarVagaPage />);

    expect(await screen.findByText('Só é possível editar vagas abertas.')).toBeInTheDocument();
  });

  it('salva as alterações e volta pro painel', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    updateJobMock.mockResolvedValue({ ...JOB, payAmount: '150.00' });
    const user = userEvent.setup();

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('130.00');
    const payInput = screen.getByLabelText('Valor por pessoa (R$)');
    await user.clear(payInput);
    await user.type(payInput, '150.00');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(updateJobMock).toHaveBeenCalled());
    expect(updateJobMock.mock.calls[0][0]).toBe('job-1');
    expect(updateJobMock.mock.calls[0][1]).toMatchObject({ payAmount: '150.00' });
    expect(pushMock).toHaveBeenCalledWith('/painel');
  });
});
