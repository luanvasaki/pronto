import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const getCurrentUserMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  };
});

const listPendingVerificationsMock = vi.fn();
const getAdminMetricsMock = vi.fn();
const reviewDocumentMock = vi.fn();
const reviewCompanyMock = vi.fn();
const reviewSkillCategoryMock = vi.fn();
const fetchDocumentFileMock = vi.fn();
const deleteDemoDataMock = vi.fn();
vi.mock('../../../lib/admin-api', () => ({
  listPendingVerifications: (...args: unknown[]) => listPendingVerificationsMock(...args),
  getAdminMetrics: (...args: unknown[]) => getAdminMetricsMock(...args),
  reviewDocument: (...args: unknown[]) => reviewDocumentMock(...args),
  reviewCompany: (...args: unknown[]) => reviewCompanyMock(...args),
  reviewSkillCategory: (...args: unknown[]) => reviewSkillCategoryMock(...args),
  fetchDocumentFile: (...args: unknown[]) => fetchDocumentFileMock(...args),
  deleteDemoData: (...args: unknown[]) => deleteDemoDataMock(...args),
}));

const SAMPLE_METRICS = {
  payments: { totalProcessed: '1500.00', countByStatus: { pending: 2, charged: 3, released: 5, failed: 0, refunded: 0 } },
  workers: { total: 10, verified: 7, active: 4 },
  companies: { total: 3, verified: 2, jobsPosted: 8 },
  shifts: { completed: 6, cancelled: 1, noShow: 0 },
};

const PENDING_DOCUMENT = {
  id: 'doc-1',
  workerId: 'worker-1',
  workerFullName: 'Rafael Lima',
  createdAt: '2026-07-01T12:00:00.000Z',
};

const PENDING_COMPANY = {
  id: 'company-1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  cnpj: '11222333000181',
};

const PENDING_CATEGORY = {
  id: 'cat-1',
  name: 'Manobrista',
  createdByName: 'Bar do Zé',
};

describe('AdminPage', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    listPendingVerificationsMock.mockReset();
    getAdminMetricsMock.mockReset().mockResolvedValue(SAMPLE_METRICS);
    reviewDocumentMock.mockReset();
    reviewCompanyMock.mockReset();
    reviewSkillCategoryMock.mockReset();
    fetchDocumentFileMock.mockReset().mockResolvedValue({ url: 'blob:mock-url', contentType: 'image/jpeg' });
    deleteDemoDataMock.mockReset();
  });

  it('mostra acesso restrito pra quem não é admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: false } });

    render(<AdminPage />);

    expect(await screen.findByText('Essa área é restrita a administradores.')).toBeInTheDocument();
    expect(listPendingVerificationsMock).not.toHaveBeenCalled();
    expect(getAdminMetricsMock).not.toHaveBeenCalled();
  });

  it('lista documentos e empresas pendentes pro admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [PENDING_COMPANY],
      skillCategories: [],
    });

    render(<AdminPage />);

    expect(await screen.findByText('Rafael Lima')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
  });

  it('mostra um link "Abrir documento (PDF)" quando o documento é um PDF, em vez de tentar renderizar como imagem', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [],
      skillCategories: [],
    });
    fetchDocumentFileMock.mockResolvedValue({ url: 'blob:mock-pdf', contentType: 'application/pdf' });

    render(<AdminPage />);

    const link = await screen.findByRole('link', { name: 'Abrir documento (PDF)' });
    expect(link).toHaveAttribute('href', 'blob:mock-pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByAltText(/documento de/i)).not.toBeInTheDocument();
  });

  it('mostra a imagem quando o documento é JPEG/PNG', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [],
      skillCategories: [],
    });
    fetchDocumentFileMock.mockResolvedValue({ url: 'blob:mock-url', contentType: 'image/jpeg' });

    render(<AdminPage />);

    const image = await screen.findByAltText('Documento de Rafael Lima');
    expect(image).toHaveAttribute('src', 'blob:mock-url');
    expect(screen.queryByRole('link', { name: /abrir documento/i })).not.toBeInTheDocument();
  });

  it('mostra as métricas gerais pro admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [] });

    render(<AdminPage />);

    expect(await screen.findByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('aprova um documento e remove ele da lista', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    reviewDocumentMock.mockResolvedValue({ id: 'doc-1', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(reviewDocumentMock).toHaveBeenCalledWith('doc-1', 'approved'));
    await waitFor(() => expect(screen.queryByText('Rafael Lima')).not.toBeInTheDocument());
  });

  it('rejeita uma empresa e remove ela da lista', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });
    reviewCompanyMock.mockResolvedValue({ id: 'company-1', verificationStatus: 'rejected' });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    await waitFor(() => expect(reviewCompanyMock).toHaveBeenCalledWith('company-1', 'rejected'));
    await waitFor(() => expect(screen.queryByText('Bar do Zé')).not.toBeInTheDocument());
  });

  it('lista categoria pendente com o nome pré-preenchido e a empresa criadora', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });

    render(<AdminPage />);

    expect(await screen.findByText('Criada por Bar do Zé')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Manobrista')).toBeInTheDocument();
  });

  it('aprova uma categoria corrigindo o nome', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista de Evento', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByDisplayValue('Manobrista');
    const nameInput = screen.getByLabelText('Nome da categoria');
    await user.clear(nameInput);
    await user.type(nameInput, 'Manobrista de Evento');
    await user.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() =>
      expect(reviewSkillCategoryMock).toHaveBeenCalledWith('cat-1', 'approved', 'Manobrista de Evento'),
    );
    await waitFor(() => expect(screen.queryByDisplayValue('Manobrista de Evento')).not.toBeInTheDocument());
  });

  it('rejeita uma categoria pendente', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista', status: 'rejected' });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByDisplayValue('Manobrista');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    await waitFor(() => expect(reviewSkillCategoryMock).toHaveBeenCalledWith('cat-1', 'rejected', 'Manobrista'));
    await waitFor(() => expect(screen.queryByDisplayValue('Manobrista')).not.toBeInTheDocument());
  });

  it('pede confirmação antes de remover os dados de demonstração', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [] });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText('Dados de demonstração');
    await user.click(screen.getByRole('button', { name: /remover dados de demonstração/i }));

    expect(screen.getByRole('button', { name: /confirmar remoção/i })).toBeInTheDocument();
    expect(deleteDemoDataMock).not.toHaveBeenCalled();
  });

  it('remove os dados de demonstração depois de confirmar', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [] });
    deleteDemoDataMock.mockResolvedValue({ companiesRemoved: 3 });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText('Dados de demonstração');
    await user.click(screen.getByRole('button', { name: /remover dados de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /confirmar remoção/i }));

    expect(deleteDemoDataMock).toHaveBeenCalled();
    expect(await screen.findByText('3 empresa(s) de demonstração removida(s).')).toBeInTheDocument();
  });

  it('cancela sem chamar a API', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [] });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText('Dados de demonstração');
    await user.click(screen.getByRole('button', { name: /remover dados de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByRole('button', { name: /remover dados de demonstração/i })).toBeInTheDocument();
    expect(deleteDemoDataMock).not.toHaveBeenCalled();
  });
});
