import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('AppLayout', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getWorkerProfileMock.mockReset();
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

  it('esconde a tab bar na tela de perfil', async () => {
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
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
