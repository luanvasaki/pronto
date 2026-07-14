import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from './layout';

const replaceMock = vi.fn();
const usePathnameMock = vi.fn(() => '/painel');
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ replace: replaceMock }),
}));

const getCurrentUserMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  };
});

const useRequireAuthMock = vi.fn();
vi.mock('../../hooks/use-require-auth', () => ({
  useRequireAuth: (...args: unknown[]) => useRequireAuthMock(...args),
}));

const getCompanyProfileMock = vi.fn();
const getCompanyNotificationsMock = vi.fn();
vi.mock('../../lib/company-profile-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/company-profile-api')>();
  return {
    ...actual,
    getCompanyProfile: (...args: unknown[]) => getCompanyProfileMock(...args),
    getCompanyNotifications: (...args: unknown[]) => getCompanyNotificationsMock(...args),
  };
});

describe('AppLayout', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    usePathnameMock.mockReset().mockReturnValue('/painel');
    useRequireAuthMock.mockReset().mockReturnValue({ isChecking: false });
    getCompanyProfileMock.mockReset();
    getCompanyNotificationsMock
      .mockReset()
      .mockResolvedValue({ pendingApplicationsCount: 0, pendingApplications: [] });
    getCurrentUserMock.mockReset().mockResolvedValue({ user: { id: '1', isAdmin: false } });
  });

  it('redireciona pro cadastro quando o perfil da empresa ainda não existe (404)', async () => {
    getCompanyProfileMock.mockRejectedValue(new ApiError(404, 'Complete o cadastro da empresa.'));

    render(
      <AppLayout>
        <p>conteúdo</p>
      </AppLayout>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/cadastro'));
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza o app normalmente quando o perfil existe', async () => {
    getCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      logoUrl: null,
      addressLabel: null,
      businessSegment: null,
      verificationStatus: 'approved',
      avgRating: null,
      totalJobsPosted: 0,
    });

    render(
      <AppLayout>
        <p>conteúdo</p>
      </AppLayout>,
    );

    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('não mostra o link de Administrador pra quem não é admin', async () => {
    getCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      logoUrl: null,
      addressLabel: null,
      businessSegment: null,
      verificationStatus: 'approved',
      avgRating: null,
      totalJobsPosted: 0,
    });

    render(
      <AppLayout>
        <p>conteúdo</p>
      </AppLayout>,
    );

    await screen.findByText('conteúdo');
    expect(screen.queryByRole('link', { name: /administrador/i })).not.toBeInTheDocument();
  });

  it('mostra o link de Administrador pra quem é admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    getCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      logoUrl: null,
      addressLabel: null,
      businessSegment: null,
      verificationStatus: 'approved',
      avgRating: null,
      totalJobsPosted: 0,
    });

    render(
      <AppLayout>
        <p>conteúdo</p>
      </AppLayout>,
    );

    await screen.findByText('conteúdo');
    expect(await screen.findByRole('link', { name: /administrador/i })).toHaveAttribute('href', '/admin');
  });

  it('mostra "Trabalhadores" como título em /trabalhadores, em vez do fallback genérico "Pronto"', async () => {
    usePathnameMock.mockReturnValue('/trabalhadores');
    getCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      logoUrl: null,
      addressLabel: null,
      businessSegment: null,
      verificationStatus: 'approved',
      avgRating: null,
      totalJobsPosted: 0,
    });

    render(
      <AppLayout>
        <p>conteúdo</p>
      </AppLayout>,
    );

    expect(await screen.findByText('Todo mundo com quem você já trabalhou')).toBeInTheDocument();
    expect(screen.queryByText('Pronto')).not.toBeInTheDocument();
  });
});
