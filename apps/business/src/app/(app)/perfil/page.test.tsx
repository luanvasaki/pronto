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
const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    logout: (...args: unknown[]) => logoutMock(...args),
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const uploadCompanyLogoMock = vi.fn();
const upsertCompanyProfileMock = vi.fn();
const changePasswordMock = vi.fn();
const listCompanyRatingsMock = vi.fn();
vi.mock('../../../lib/company-profile-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/company-profile-api')>();
  return {
    ...actual,
    uploadCompanyLogo: (...args: unknown[]) => uploadCompanyLogoMock(...args),
    upsertCompanyProfile: (...args: unknown[]) => upsertCompanyProfileMock(...args),
    changePassword: (...args: unknown[]) => changePasswordMock(...args),
    listCompanyRatings: (...args: unknown[]) => listCompanyRatingsMock(...args),
  };
});

const BASE_PROFILE: CompanyProfileDetails = {
  id: '1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  cnpj: '11222333000181',
  logoUrl: null,
  addressLabel: null,
  businessSegment: null,
  businessSegmentOther: null,
  verificationStatus: 'approved',
  avgRating: '4.2',
  avgCategoryScores: { pontualidade_pagamento: '4.5', clareza_vaga: '4.0' },
  totalJobsPosted: 5,
  jobsPosted: 5,
  shiftsCompleted: 8,
  rehireRate: 40,
  jobsOpenedThisMonth: 0,
  workersHiredThisMonth: 0,
  topHiredWorkerName: null,
  topHiredWorkerCount: 0,
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
    upsertCompanyProfileMock.mockReset();
    changePasswordMock.mockReset();
    logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [] });
    listCompanyRatingsMock.mockReset().mockResolvedValue({ ratings: [] });
  });

  it('mostra os dados e as estatísticas da empresa', async () => {
    renderWithProfile(BASE_PROFILE);

    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé Ltda')).toBeInTheDocument();
    expect(screen.getByText('Empresa verificada')).toBeInTheDocument();
    expect(screen.getByText('★ 4.2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('mostra avaliações recebidas com trabalhador, nota, comentário e categorias', async () => {
    listCompanyRatingsMock.mockResolvedValue({
      ratings: [
        {
          id: 'rating-1',
          workerName: 'Rafael Lima',
          categoryId: 'cat-1',
          score: 4,
          categoryScores: { pontualidade_pagamento: 4 },
          comment: 'Endereço claro e pagamento em dia.',
          shiftDate: '2026-07-01T20:00:00.000Z',
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
    });

    renderWithProfile(BASE_PROFILE);

    expect(await screen.findByText('Avaliações recebidas')).toBeInTheDocument();
    expect(screen.getByText('Rafael Lima')).toBeInTheDocument();
    expect(screen.getByText('★ 4')).toBeInTheDocument();
    expect(screen.getByText('"Endereço claro e pagamento em dia."')).toBeInTheDocument();
    expect(screen.getByText('★4 Pontualidade no pagamento')).toBeInTheDocument();
  });

  it('não mostra a seção de avaliações recebidas quando ainda não há nenhuma', async () => {
    renderWithProfile(BASE_PROFILE);

    await waitFor(() => expect(listCompanyRatingsMock).toHaveBeenCalled());
    expect(screen.queryByText('Avaliações recebidas')).not.toBeInTheDocument();
  });

  it('mostra os pontos fortes por categoria quando disponíveis', async () => {
    renderWithProfile(BASE_PROFILE);

    expect(screen.getByText('Pontos fortes da empresa')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5 Pontualidade no pagamento')).toBeInTheDocument();
    expect(screen.getByText('★ 4.0 Clareza das informações da vaga')).toBeInTheDocument();
  });

  it('não mostra a seção de pontos fortes sem avaliações por categoria ainda', async () => {
    renderWithProfile({ ...BASE_PROFILE, avgCategoryScores: null });

    expect(screen.queryByText('Pontos fortes da empresa')).not.toBeInTheDocument();
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

  it('salva os dados da empresa com os valores editados', async () => {
    upsertCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé Eventos Ltda',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      addressLabel: 'Vila Madalena, São Paulo',
      businessSegment: 'bar',
      verificationStatus: 'approved',
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    const legalNameInput = screen.getByLabelText('Razão social');
    await user.clear(legalNameInput);
    await user.type(legalNameInput, 'Bar do Zé Eventos Ltda');
    await user.type(screen.getByLabelText(/endereço/i), 'Vila Madalena, São Paulo');
    await user.selectOptions(screen.getByLabelText(/ramo de atividade/i), 'bar');
    await user.click(screen.getByRole('button', { name: /salvar dados da empresa/i }));

    await waitFor(() =>
      expect(upsertCompanyProfileMock).toHaveBeenCalledWith({
        legalName: 'Bar do Zé Eventos Ltda',
        tradeName: 'Bar do Zé',
        cnpj: '11222333000181',
        addressLabel: 'Vila Madalena, São Paulo',
        businessSegment: 'bar',
      }),
    );
    expect(await screen.findByText('Dados salvos.')).toBeInTheDocument();
  });

  it('pede pra digitar o ramo quando escolhe "Outro" e envia o texto', async () => {
    upsertCompanyProfileMock.mockResolvedValue({
      id: '1',
      legalName: 'Bar do Zé',
      tradeName: 'Bar do Zé',
      cnpj: '11222333000181',
      businessSegment: 'outro',
      businessSegmentOther: 'Confeitaria',
      verificationStatus: 'approved',
    });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.selectOptions(screen.getByLabelText(/ramo de atividade/i), 'outro');
    const saveButton = screen.getByRole('button', { name: /salvar dados da empresa/i });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText(/qual é o ramo de atividade/i), 'Confeitaria');
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() =>
      expect(upsertCompanyProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          businessSegment: 'outro',
          businessSegmentOther: 'Confeitaria',
        }),
      ),
    );
  });

  it('mostra erro da API ao falhar salvar dados da empresa', async () => {
    upsertCompanyProfileMock.mockRejectedValue(new Error('falha'));
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.click(screen.getByRole('button', { name: /salvar dados da empresa/i }));

    expect(await screen.findByText('Não foi possível salvar os dados da empresa.')).toBeInTheDocument();
  });

  it('troca a senha com sucesso', async () => {
    changePasswordMock.mockResolvedValue({ message: 'Senha alterada.' });
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.type(screen.getByLabelText('Senha atual'), 'senha-atual-123');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-nova-456');
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'senha-nova-456');
    await user.click(screen.getByRole('button', { name: /^alterar senha$/i }));

    await waitFor(() => expect(changePasswordMock).toHaveBeenCalledWith('senha-atual-123', 'senha-nova-456'));
    expect(await screen.findByText('Senha alterada.')).toBeInTheDocument();
  });

  it('mostra erro quando a confirmação de senha não bate', async () => {
    const user = userEvent.setup();
    renderWithProfile(BASE_PROFILE);

    await user.type(screen.getByLabelText('Senha atual'), 'senha-atual-123');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-nova-456');
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'outra-coisa');

    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^alterar senha$/i })).toBeDisabled();
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
