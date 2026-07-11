import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminVerificacoesPage from './page';

const listPendingVerificationsMock = vi.fn();
const reviewDocumentMock = vi.fn();
const reviewCompanyMock = vi.fn();
const reviewSkillCategoryMock = vi.fn();
const fetchDocumentFileMock = vi.fn();
const fetchCompanyDocumentFileMock = vi.fn();
vi.mock('../../../lib/admin-api', () => ({
  listPendingVerifications: (...args: unknown[]) => listPendingVerificationsMock(...args),
  reviewDocument: (...args: unknown[]) => reviewDocumentMock(...args),
  reviewCompany: (...args: unknown[]) => reviewCompanyMock(...args),
  reviewSkillCategory: (...args: unknown[]) => reviewSkillCategoryMock(...args),
  fetchDocumentFile: (...args: unknown[]) => fetchDocumentFileMock(...args),
  fetchCompanyDocumentFile: (...args: unknown[]) => fetchCompanyDocumentFileMock(...args),
}));

const PENDING_DOCUMENT = {
  id: 'doc-1',
  workerId: 'worker-1',
  workerFullName: 'Rafael Lima',
  type: 'identity',
  createdAt: '2026-07-01T12:00:00.000Z',
};

const PENDING_SELFIE = {
  id: 'doc-2',
  workerId: 'worker-1',
  workerFullName: 'Rafael Lima',
  type: 'selfie',
  createdAt: '2026-07-01T12:00:00.000Z',
};

const PENDING_COMPANY = {
  id: 'company-1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  personType: 'juridica',
  cnpj: '11222333000181',
  cpf: null,
  documentId: null,
};

const PENDING_INDIVIDUAL_COMPANY = {
  id: 'company-2',
  legalName: 'Ana Souza',
  tradeName: 'Ana Freelas',
  personType: 'fisica',
  cnpj: null,
  cpf: '11122233344',
  documentId: 'company-doc-1',
};

const PENDING_CATEGORY = {
  id: 'cat-1',
  name: 'Manobrista',
  createdByName: 'Bar do Zé',
};

describe('AdminVerificacoesPage', () => {
  beforeEach(() => {
    listPendingVerificationsMock.mockReset();
    reviewDocumentMock.mockReset();
    reviewCompanyMock.mockReset();
    reviewSkillCategoryMock.mockReset();
    fetchDocumentFileMock.mockReset().mockResolvedValue({ url: 'blob:mock-url', contentType: 'image/jpeg' });
    fetchCompanyDocumentFileMock.mockReset().mockResolvedValue({ url: 'blob:mock-company-doc', contentType: 'image/jpeg' });
  });

  it('lista documentos e empresas pendentes', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [PENDING_COMPANY],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Rafael Lima')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
  });

  it('mostra um link "Abrir documento (PDF)" quando o documento é um PDF, em vez de tentar renderizar como imagem', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [],
      skillCategories: [],
    });
    fetchDocumentFileMock.mockResolvedValue({ url: 'blob:mock-pdf', contentType: 'application/pdf' });

    render(<AdminVerificacoesPage />);

    const link = await screen.findByRole('link', { name: 'Abrir documento (PDF)' });
    expect(link).toHaveAttribute('href', 'blob:mock-pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByAltText(/documento de/i)).not.toBeInTheDocument();
  });

  it('mostra a imagem quando o documento é JPEG/PNG', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [],
      skillCategories: [],
    });
    fetchDocumentFileMock.mockResolvedValue({ url: 'blob:mock-url', contentType: 'image/jpeg' });

    render(<AdminVerificacoesPage />);

    const image = await screen.findByAltText('Documento (RG/CNH) de Rafael Lima');
    expect(image).toHaveAttribute('src', 'blob:mock-url');
    expect(screen.queryByRole('link', { name: /abrir documento/i })).not.toBeInTheDocument();
  });

  it('agrupa identidade e selfie do mesmo trabalhador no mesmo card', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT, PENDING_SELFIE],
      companies: [],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findAllByText('Rafael Lima')).toHaveLength(1);
    expect(screen.getByText('Documento (RG/CNH)')).toBeInTheDocument();
    expect(screen.getByText('Selfie')).toBeInTheDocument();
  });

  it('aprova um documento e remove ele da lista', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    reviewDocumentMock.mockResolvedValue({ id: 'doc-1', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(reviewDocumentMock).toHaveBeenCalledWith('doc-1', 'approved'));
    await waitFor(() => expect(screen.queryByText('Rafael Lima')).not.toBeInTheDocument());
  });

  it('rejeita uma empresa e remove ela da lista', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });
    reviewCompanyMock.mockResolvedValue({ id: 'company-1', verificationStatus: 'rejected' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    await waitFor(() => expect(reviewCompanyMock).toHaveBeenCalledWith('company-1', 'rejected'));
    await waitFor(() => expect(screen.queryByText('Bar do Zé')).not.toBeInTheDocument());
  });

  it('mostra CNPJ pra empresa jurídica', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('CNPJ 11222333000181')).toBeInTheDocument();
  });

  it('mostra CPF e o documento enviado pra empresa pessoa física', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [],
      companies: [PENDING_INDIVIDUAL_COMPANY],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('CPF 11122233344')).toBeInTheDocument();
    expect(fetchCompanyDocumentFileMock).toHaveBeenCalledWith('company-doc-1');
    const image = await screen.findByAltText('Documento de Ana Freelas');
    expect(image).toHaveAttribute('src', 'blob:mock-company-doc');
  });

  it('avisa quando a empresa pessoa física não enviou documento', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [],
      companies: [{ ...PENDING_INDIVIDUAL_COMPANY, documentId: null }],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Nenhum documento enviado.')).toBeInTheDocument();
    expect(fetchCompanyDocumentFileMock).not.toHaveBeenCalled();
  });

  it('lista categoria pendente com o nome pré-preenchido e a empresa criadora', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Criada por Bar do Zé')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Manobrista')).toBeInTheDocument();
  });

  it('aprova uma categoria corrigindo o nome', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista de Evento', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
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
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista', status: 'rejected' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByDisplayValue('Manobrista');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    await waitFor(() => expect(reviewSkillCategoryMock).toHaveBeenCalledWith('cat-1', 'rejected', 'Manobrista'));
    await waitFor(() => expect(screen.queryByDisplayValue('Manobrista')).not.toBeInTheDocument());
  });
});
