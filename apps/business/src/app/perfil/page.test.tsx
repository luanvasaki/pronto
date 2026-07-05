import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PerfilPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
  };
});

const getCompanyProfileMock = vi.fn();
vi.mock('../../lib/company-profile-api', () => ({
  getCompanyProfile: (...args: unknown[]) => getCompanyProfileMock(...args),
}));

describe('PerfilPage', () => {
  beforeEach(() => {
    getCompanyProfileMock.mockReset();
  });

  it('mostra os dados e as estatísticas da empresa', async () => {
    getCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      verificationStatus: 'approved',
      avgRating: '4.2',
      totalJobsPosted: 5,
    });

    render(<PerfilPage />);

    expect(await screen.findByText('Bar do Zé')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé Ltda')).toBeInTheDocument();
    expect(screen.getByText('Empresa verificada')).toBeInTheDocument();
    expect(screen.getByText('★ 4.2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('mostra travessão quando ainda não tem nota', async () => {
    getCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      verificationStatus: 'pending',
      avgRating: null,
      totalJobsPosted: 0,
    });

    render(<PerfilPage />);

    await screen.findByText('Bar do Zé');
    expect(screen.getByText('Verificação em análise')).toBeInTheDocument();
    expect(screen.getByText('★ —')).toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    getCompanyProfileMock.mockRejectedValue(new Error('falhou'));

    render(<PerfilPage />);

    expect(await screen.findByText('Não foi possível carregar o perfil da empresa.')).toBeInTheDocument();
  });
});
