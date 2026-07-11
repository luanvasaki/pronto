import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminEmpresasPage from './page';

const listAdminCompaniesMock = vi.fn();
const resetUserPasswordMock = vi.fn();
vi.mock('../../../lib/admin-api', () => ({
  listAdminCompanies: (...args: unknown[]) => listAdminCompaniesMock(...args),
  resetUserPassword: (...args: unknown[]) => resetUserPasswordMock(...args),
}));

const COMPANY = {
  id: 'company-1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  personType: 'juridica',
  cnpj: '11222333000181',
  cpf: null,
  logoUrl: '/uploads/public/bar-do-ze.jpg',
  verificationStatus: 'approved',
  avgRating: '4.5',
  ownerUserId: 'owner-1',
  ownerEmail: 'owner@example.com',
  jobsPosted: 3,
  shiftsCompleted: 5,
  createdAt: '2026-07-01T12:00:00.000Z',
};

describe('AdminEmpresasPage', () => {
  beforeEach(() => {
    listAdminCompaniesMock.mockReset();
    resetUserPasswordMock.mockReset();
  });

  it('mostra o logo da empresa', async () => {
    listAdminCompaniesMock.mockResolvedValue({ companies: [COMPANY] });

    render(<AdminEmpresasPage />);

    const logo = await screen.findByAltText('Bar do Zé');
    expect(logo).toHaveAttribute('src', '/uploads/public/bar-do-ze.jpg');
  });

  it('mostra iniciais quando a empresa não tem logo', async () => {
    listAdminCompaniesMock.mockResolvedValue({ companies: [{ ...COMPANY, logoUrl: null }] });

    render(<AdminEmpresasPage />);

    await screen.findByText('Bar do Zé');
    expect(screen.queryByAltText('Bar do Zé')).not.toBeInTheDocument();
  });

  it('mostra CPF em vez de CNPJ pra empresa pessoa física', async () => {
    listAdminCompaniesMock.mockResolvedValue({
      companies: [
        {
          ...COMPANY,
          id: 'company-2',
          tradeName: 'Ana Freelas',
          personType: 'fisica',
          cnpj: null,
          cpf: '11122233344',
        },
      ],
    });

    render(<AdminEmpresasPage />);

    expect(await screen.findByText('CPF 11122233344')).toBeInTheDocument();
    expect(screen.queryByText(/^CNPJ/)).not.toBeInTheDocument();
  });
});
