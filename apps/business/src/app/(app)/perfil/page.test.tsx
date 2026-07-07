import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyProfileDetails } from '../../../lib/company-profile-api';
import { CompanyProfileProvider } from '../company-profile-context';
import PerfilPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: pushMock }),
}));

const logoutMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    logout: (...args: unknown[]) => logoutMock(...args),
  };
});

const uploadCompanyLogoMock = vi.fn();
vi.mock('../../../lib/company-profile-api', () => ({
  uploadCompanyLogo: (...args: unknown[]) => uploadCompanyLogoMock(...args),
}));

const BASE_PROFILE: CompanyProfileDetails = {
  id: '1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  cnpj: '11222333000181',
  logoUrl: null,
  verificationStatus: 'approved',
  avgRating: '4.2',
  totalJobsPosted: 5,
};

function renderWithProfile(profile: CompanyProfileDetails | null) {
  return render(
    <CompanyProfileProvider initialProfile={profile}>
      <PerfilPage />
    </CompanyProfileProvider>,
  );
}

describe('PerfilPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    uploadCompanyLogoMock.mockReset();
    logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
  });

  it('mostra os dados e as estatísticas da empresa', async () => {
    renderWithProfile(BASE_PROFILE);

    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé Ltda')).toBeInTheDocument();
    expect(screen.getByText('Empresa verificada')).toBeInTheDocument();
    expect(screen.getByText('★ 4.2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('mostra travessão quando ainda não tem nota', async () => {
    renderWithProfile({ ...BASE_PROFILE, verificationStatus: 'pending', avgRating: null, totalJobsPosted: 0 });

    expect(screen.getByText('Verificação em análise')).toBeInTheDocument();
    expect(screen.getByText('★ —')).toBeInTheDocument();
  });

  it('mostra mensagem quando o perfil não está disponível', () => {
    renderWithProfile(null);

    expect(screen.getByText('Perfil não encontrado.')).toBeInTheDocument();
  });

  it('envia o logo escolhido e mostra o preview', async () => {
    uploadCompanyLogoMock.mockResolvedValue({ logoUrl: '/uploads/public/logo.jpg' });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    expect(screen.getByText('Adicionar logo')).toBeInTheDocument();
    const file = new File(['logo'], 'logo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar logo/i), file);

    expect(uploadCompanyLogoMock).toHaveBeenCalledWith(file);
    expect(await screen.findByText('Trocar logo')).toBeInTheDocument();
    expect(screen.getByAltText('Bar do Zé')).toHaveAttribute('src', '/uploads/public/logo.jpg');
  });

  it('chama logout e navega pro login ao clicar em "Sair da conta"', async () => {
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    const logoutButton = screen.getByRole('button', { name: /sair da conta/i });
    await user.click(logoutButton);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/entrar'));
    expect(logoutMock).toHaveBeenCalled();
  });
});
