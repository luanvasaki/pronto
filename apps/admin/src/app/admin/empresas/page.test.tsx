import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  termsAcceptedAt: '2026-06-01T10:00:00.000Z',
  termsVersion: '1.1',
  termsIpAddress: '203.0.113.1',
  loginTermsAcceptedAt: '2026-06-02T10:00:00.000Z',
  loginTermsVersion: '1.0',
  loginTermsIpAddress: '203.0.113.2',
  minorsTermsJobs: [
    {
      jobId: 'job-1',
      description: 'Vaga de garçom pra evento',
      minorsTermsAcceptedAt: '2026-06-03T10:00:00.000Z',
      minorsTermsVersion: '1.1',
      minorsTermsIpAddress: '203.0.113.3',
    },
  ],
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

  it('pede confirmação antes de resetar a senha, e só chama a API no segundo clique', async () => {
    listAdminCompaniesMock.mockResolvedValue({ companies: [COMPANY] });
    resetUserPasswordMock.mockResolvedValue({ email: 'owner@example.com' });
    const user = userEvent.setup();

    render(<AdminEmpresasPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: 'Resetar senha' }));

    expect(resetUserPasswordMock).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Confirmar envio' }));

    expect(resetUserPasswordMock).toHaveBeenCalledWith('owner-1');
    expect(await screen.findByText('Link de redefinição enviado pra owner@example.com.')).toBeInTheDocument();
  });

  it('cancela a confirmação de resetar senha sem chamar a API', async () => {
    listAdminCompaniesMock.mockResolvedValue({ companies: [COMPANY] });
    const user = userEvent.setup();

    render(<AdminEmpresasPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: 'Resetar senha' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('button', { name: 'Confirmar envio' })).not.toBeInTheDocument();
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('mostra erro quando resetar a senha falha', async () => {
    listAdminCompaniesMock.mockResolvedValue({ companies: [COMPANY] });
    resetUserPasswordMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<AdminEmpresasPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: 'Resetar senha' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar envio' }));

    expect(await screen.findByText('Não foi possível enviar o link.')).toBeInTheDocument();
  });

  it('mostra o histórico de aceite de termos (incluindo o de vagas pra menores) ao expandir', async () => {
    listAdminCompaniesMock.mockResolvedValue({ companies: [COMPANY] });
    const user = userEvent.setup();

    render(<AdminEmpresasPage />);
    await screen.findByText('Bar do Zé');
    expect(screen.queryByText(/^v1\.1 ·/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver histórico de aceite de termos' }));

    expect(screen.getByText(/^v1\.1 · .* IP 203\.0\.113\.1$/)).toBeInTheDocument();
    expect(screen.getByText(/^v1\.0 · .* IP 203\.0\.113\.2$/)).toBeInTheDocument();
    expect(screen.getByText(/Vaga de garçom pra evento — v1\.1 · .* IP 203\.0\.113\.3$/)).toBeInTheDocument();
  });
});
