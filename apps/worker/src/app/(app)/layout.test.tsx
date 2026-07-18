import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from './layout';

const replaceMock = vi.fn();
let pathnameMock = '/inicio';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathnameMock,
}));

const getCurrentUserMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  };
});

const getWorkerProfileMock = vi.fn();
vi.mock('../../lib/worker-profile-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/worker-profile-api')>();
  return {
    ...actual,
    getWorkerProfile: (...args: unknown[]) => getWorkerProfileMock(...args),
  };
});

const listMyApplicationsMock = vi.fn();
vi.mock('../../lib/applications-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/applications-api')>();
  return {
    ...actual,
    listMyApplications: (...args: unknown[]) => listMyApplicationsMock(...args),
  };
});

const listMyShiftsMock = vi.fn();
vi.mock('../../lib/shifts-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/shifts-api')>();
  return {
    ...actual,
    listMyShifts: (...args: unknown[]) => listMyShiftsMock(...args),
  };
});

describe('AppLayout', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getWorkerProfileMock.mockReset();
    listMyApplicationsMock.mockReset().mockResolvedValue({ applications: [] });
    listMyShiftsMock.mockReset().mockResolvedValue({ shifts: [] });
    replaceMock.mockClear();
    pathnameMock = '/inicio';
  });

  it('mostra confirmando sessão em vez do conteúdo enquanto checa', () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    expect(screen.getByText(/confirmando sua sessão/i)).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('mostra o conteúdo e a tab bar quando a sessão é válida e o perfil existe', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'approved',
      hasDocument: true,
      hasSelfie: true,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalledWith('/cadastro');
    expect(replaceMock).not.toHaveBeenCalledWith('/cadastro/documento');
    expect(screen.getByText(/, Ana$/)).toBeInTheDocument();
  });

  it('redireciona pro cadastro quando o perfil ainda não existe (404)', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockRejectedValue(new ApiError(404, 'Complete seu cadastro antes de ver o perfil.'));

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/cadastro'));
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('redireciona pro upload de documento quando o perfil existe mas o documento ainda não foi enviado', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'pending',
      hasDocument: false,
      hasSelfie: false,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('redireciona pro upload de documento quando o documento foi enviado mas a selfie não', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'pending',
      hasDocument: true,
      hasSelfie: false,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('redireciona pro upload de documento quando o trabalhador é menor e o documento do responsável ainda não foi enviado, mesmo com identidade+selfie prontos', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'pending',
      hasDocument: true,
      hasSelfie: true,
      isMinor: true,
      hasGuardianDocument: false,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('não redireciona pro upload de documento quando o trabalhador é menor mas já enviou o documento do responsável', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'pending',
      hasDocument: true,
      hasSelfie: true,
      isMinor: true,
      hasGuardianDocument: true,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalledWith('/cadastro/documento');
  });

  it('mostra a tab bar também na tela de perfil, pra dar um jeito de voltar pro resto do app', async () => {
    pathnameMock = '/perfil';
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'approved',
      hasDocument: true,
      hasSelfie: true,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await screen.findByText('Conteúdo protegido');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('mostra o número de candidaturas aprovadas ainda não vistas no sino', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'approved',
      hasDocument: true,
      hasSelfie: true,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        { id: 'a1', status: 'approved', workerSeenAt: null, createdAt: '2026-07-01T12:00:00.000Z' },
        { id: 'a2', status: 'pending', workerSeenAt: null, createdAt: '2026-07-01T12:00:00.000Z' },
        { id: 'a3', status: 'approved', workerSeenAt: '2026-07-02T12:00:00.000Z', createdAt: '2026-07-01T12:00:00.000Z' },
      ],
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await screen.findByText('Conteúdo protegido');
    expect(await screen.findByLabelText('1 chamada(s) pra trabalhar')).toBeInTheDocument();
  });

  it('mostra candidatura removida no sino, com o nome da empresa e link pro Início', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'approved',
      hasDocument: true,
      hasSelfie: true,
      avgRating: null,
      totalShiftsCompleted: 0,
      totalHoursWorked: 0,
    });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'a1',
          status: 'rejected',
          companyName: 'Bar do Zé',
          workerSeenAt: '2026-07-01T12:00:00.000Z',
          removedAt: '2026-07-02T12:00:00.000Z',
          workerSeenRemovalAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
        },
      ],
    });
    const user = userEvent.setup();

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await screen.findByText('Conteúdo protegido');
    const bell = await screen.findByLabelText('1 chamada(s) pra trabalhar');
    await user.click(bell);

    const link = screen.getByRole('link', { name: /Bar do Zé removeu você da escala/i });
    expect(link).toHaveAttribute('href', '/inicio');
  });

  it('mostra escala concluída sem avaliação no sino, levando pra Agenda', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      bio: null,
      cpf: null,
      categoryIds: ['cat-1'],
      photoUrl: null,
      homeAddressLabel: null,
      kycStatus: 'approved',
      hasDocument: true,
      hasSelfie: true,
      avgRating: null,
      totalShiftsCompleted: 1,
      totalHoursWorked: 5,
    });
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        { id: 'shift-1', status: 'completed', ratings: { worker: null, company: null } },
        { id: 'shift-2', status: 'completed', ratings: { worker: { id: 'r1' }, company: null } },
      ],
    });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    await screen.findByText('Conteúdo protegido');
    const bell = await screen.findByLabelText('1 chamada(s) pra trabalhar');
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(bell);

    expect(screen.getByRole('link', { name: /escala concluída esperando avaliação/i })).toHaveAttribute(
      'href',
      '/agenda',
    );
  });
});
