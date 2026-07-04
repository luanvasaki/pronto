import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VagaCandidatosPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useParams: () => ({ id: 'job-1' }),
}));

vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
  };
});

const listJobApplicationsMock = vi.fn();
const updateApplicationStatusMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
  updateApplicationStatus: (...args: unknown[]) => updateApplicationStatusMock(...args),
}));

const PENDING_APPLICATION = {
  id: 'app-1',
  status: 'pending',
  createdAt: '2026-07-01T12:00:00.000Z',
  worker: { id: 'worker-1', fullName: 'Ana Souza', avgRating: null },
  shift: null,
};

describe('VagaCandidatosPage', () => {
  beforeEach(() => {
    listJobApplicationsMock.mockReset();
    updateApplicationStatusMock.mockReset();
  });

  it('mostra estado vazio quando não há candidatos', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [] });

    render(<VagaCandidatosPage />);

    expect(
      await screen.findByText('Ninguém se candidatou a essa vaga ainda.'),
    ).toBeInTheDocument();
    expect(listJobApplicationsMock).toHaveBeenCalledWith('job-1');
  });

  it('lista os candidatos com nome e status', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Em análise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeInTheDocument();
  });

  it('não mostra botões de decisão pra candidatura já respondida', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ ...PENDING_APPLICATION, status: 'approved' }],
    });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
  });

  it('aprova um candidato, recarrega a lista e mostra o turno criado', async () => {
    const approvedWithShift = {
      ...PENDING_APPLICATION,
      status: 'approved',
      shift: { id: 'shift-1', status: 'scheduled', checkInAt: null, checkOutAt: null },
    };
    listJobApplicationsMock
      .mockResolvedValueOnce({ applications: [PENDING_APPLICATION] })
      .mockResolvedValueOnce({ applications: [approvedWithShift] });
    updateApplicationStatusMock.mockResolvedValue({ id: 'app-1', status: 'approved' });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');
    await user.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByText('Aprovado')).toBeInTheDocument());
    expect(screen.getByText('Turno: Aguardando check-in')).toBeInTheDocument();
    expect(updateApplicationStatusMock).toHaveBeenCalledWith('app-1', 'approved');
    expect(listJobApplicationsMock).toHaveBeenCalledTimes(2);
  });

  it('mostra a mensagem da API quando a decisão falha', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });
    updateApplicationStatusMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    expect(
      await screen.findByText('Não foi possível atualizar a candidatura.'),
    ).toBeInTheDocument();
  });
});
