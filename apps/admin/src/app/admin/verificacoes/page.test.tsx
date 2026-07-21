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

  it('mostra os dados do responsável quando o trabalhador é menor de idade', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [
        {
          ...PENDING_DOCUMENT,
          type: 'guardian_identity',
          isMinor: true,
          guardianFullName: 'José Lima',
          guardianCpf: '11122283148',
          guardianPhone: '11988887777',
        },
      ],
      companies: [],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Documento do responsável')).toBeInTheDocument();
    expect(screen.getByText('Trabalhador menor de idade (16-17 anos)')).toBeInTheDocument();
    expect(screen.getByText('Responsável: José Lima · CPF 111.222.831-48 · (11) 98888-7777')).toBeInTheDocument();
  });

  it('não mostra o aviso de responsável quando o trabalhador não é menor de idade', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [{ ...PENDING_DOCUMENT, isMinor: false, guardianFullName: null, guardianCpf: null, guardianPhone: null }],
      companies: [],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    await screen.findByText('Rafael Lima');
    expect(screen.queryByText(/menor de idade/i)).not.toBeInTheDocument();
  });

  it('pede confirmação antes de aprovar um documento, e só chama a API no segundo clique', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    reviewDocumentMock.mockResolvedValue({ id: 'doc-1', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: /^aprovar$/i }));

    expect(reviewDocumentMock).not.toHaveBeenCalled();
    const confirmButton = await screen.findByRole('button', { name: /confirmar aprovação/i });

    await user.click(confirmButton);

    await waitFor(() => expect(reviewDocumentMock).toHaveBeenCalledWith('doc-1', 'approved'));
    await waitFor(() => expect(screen.queryByText('Rafael Lima')).not.toBeInTheDocument());
  });

  it('mostra erro e mantém o documento na lista quando revisar falha', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    reviewDocumentMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: /^aprovar$/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar aprovação/i }));

    expect(await screen.findByText('Não foi possível revisar o documento.')).toBeInTheDocument();
    expect(screen.getByText('Rafael Lima')).toBeInTheDocument();
  });

  it('cancela a confirmação de aprovar um documento sem chamar a API', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: /^aprovar$/i }));
    await screen.findByRole('button', { name: /confirmar aprovação/i });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('button', { name: /confirmar aprovação/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^aprovar$/i })).toBeInTheDocument();
    expect(reviewDocumentMock).not.toHaveBeenCalled();
  });

  it('pede confirmação antes de rejeitar uma empresa, e só chama a API no segundo clique', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });
    reviewCompanyMock.mockResolvedValue({ id: 'company-1', verificationStatus: 'rejected' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Bar do Zé');
    await user.type(screen.getByLabelText(/motivo da rejeição/i), 'Foto do cartão CNPJ ilegível');
    await user.click(screen.getByRole('button', { name: /^rejeitar$/i }));

    expect(reviewCompanyMock).not.toHaveBeenCalled();
    const confirmButton = await screen.findByRole('button', { name: /confirmar rejeição/i });

    await user.click(confirmButton);

    await waitFor(() =>
      expect(reviewCompanyMock).toHaveBeenCalledWith('company-1', 'rejected', 'Foto do cartão CNPJ ilegível'),
    );
    await waitFor(() => expect(screen.queryByText('Bar do Zé')).not.toBeInTheDocument());
  });

  it('não deixa rejeitar uma empresa sem preencher o motivo', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: /^rejeitar$/i }));

    expect(await screen.findByText('Escreva o motivo antes de rejeitar.')).toBeInTheDocument();
    expect(reviewCompanyMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /confirmar rejeição/i })).not.toBeInTheDocument();
  });

  it('mostra erro e mantém a empresa na lista quando revisar falha', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });
    reviewCompanyMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Bar do Zé');
    await user.type(screen.getByLabelText(/motivo da rejeição/i), 'Foto do cartão CNPJ ilegível');
    await user.click(screen.getByRole('button', { name: /^rejeitar$/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar rejeição/i }));

    expect(await screen.findByText('Não foi possível revisar a empresa.')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
  });

  it('mostra CNPJ pra empresa jurídica', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('CNPJ 11222333000181')).toBeInTheDocument();
  });

  it('avisa quando a empresa jurídica não enviou o documento (cartão CNPJ), e desabilita aprovar', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY], skillCategories: [] });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Documento (cartão CNPJ)')).toBeInTheDocument();
    expect(screen.getByText('Nenhum documento enviado.')).toBeInTheDocument();
    expect(fetchCompanyDocumentFileMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeDisabled();
    expect(screen.getByText('Sem documento enviado — não é possível aprovar.')).toBeInTheDocument();
  });

  it('mostra o documento (cartão CNPJ) e habilita aprovar quando a empresa jurídica já enviou', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [],
      companies: [{ ...PENDING_COMPANY, documentId: 'company-doc-2' }],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByAltText('Documento de Bar do Zé')).toHaveAttribute('src', 'blob:mock-company-doc');
    expect(fetchCompanyDocumentFileMock).toHaveBeenCalledWith('company-doc-2');
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeEnabled();
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

  it('avisa quando a empresa pessoa física não enviou documento, e desabilita aprovar', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [],
      companies: [{ ...PENDING_INDIVIDUAL_COMPANY, documentId: null }],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Nenhum documento enviado.')).toBeInTheDocument();
    expect(fetchCompanyDocumentFileMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeDisabled();
    expect(screen.getByText('Sem documento enviado — não é possível aprovar.')).toBeInTheDocument();
    // Rejeitar continua disponível — a falta de documento não impede recusar.
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeEnabled();
  });

  it('não desabilita aprovar quando a empresa pessoa física já tem documento', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [],
      companies: [PENDING_INDIVIDUAL_COMPANY],
      skillCategories: [],
    });

    render(<AdminVerificacoesPage />);

    await screen.findByText('CPF 11122233344');
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeEnabled();
    expect(screen.queryByText('Sem documento enviado — não é possível aprovar.')).not.toBeInTheDocument();
  });

  it('lista categoria pendente com o nome pré-preenchido e a empresa criadora', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText('Criada por Bar do Zé')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Manobrista')).toBeInTheDocument();
  });

  it('aprova uma categoria corrigindo o nome, depois de confirmar', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista de Evento', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByDisplayValue('Manobrista');
    const nameInput = screen.getByLabelText('Nome da categoria');
    await user.clear(nameInput);
    await user.type(nameInput, 'Manobrista de Evento');
    await user.click(screen.getByRole('button', { name: /^aprovar$/i }));

    expect(reviewSkillCategoryMock).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: /confirmar aprovação/i }));

    await waitFor(() =>
      expect(reviewSkillCategoryMock).toHaveBeenCalledWith('cat-1', 'approved', 'Manobrista de Evento'),
    );
    await waitFor(() => expect(screen.queryByDisplayValue('Manobrista de Evento')).not.toBeInTheDocument());
  });

  it('rejeita uma categoria pendente, depois de confirmar', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista', status: 'rejected' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByDisplayValue('Manobrista');
    await user.click(screen.getByRole('button', { name: /^rejeitar$/i }));

    expect(reviewSkillCategoryMock).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: /confirmar rejeição/i }));

    await waitFor(() => expect(reviewSkillCategoryMock).toHaveBeenCalledWith('cat-1', 'rejected', 'Manobrista'));
    await waitFor(() => expect(screen.queryByDisplayValue('Manobrista')).not.toBeInTheDocument());
  });

  it('mostra erro e mantém a categoria na lista quando revisar falha', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [PENDING_CATEGORY] });
    reviewSkillCategoryMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByDisplayValue('Manobrista');
    await user.click(screen.getByRole('button', { name: /^aprovar$/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar aprovação/i }));

    expect(await screen.findByText('Não foi possível revisar a categoria.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Manobrista')).toBeInTheDocument();
  });

  it('mostra a dica de atalhos só quando há documentos pendentes', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });

    render(<AdminVerificacoesPage />);

    expect(await screen.findByText(/troca o documento em destaque/i)).toBeInTheDocument();
  });

  it('não mostra a dica de atalhos quando não há documentos pendentes', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [], skillCategories: [] });

    render(<AdminVerificacoesPage />);

    await screen.findByText('Nenhum documento pendente.');
    expect(screen.queryByText(/troca o documento em destaque/i)).not.toBeInTheDocument();
  });

  it('destaca o primeiro documento automaticamente e troca com as setas', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT, PENDING_SELFIE],
      companies: [],
      skillCategories: [],
    });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    const identityImage = await screen.findByAltText('Documento (RG/CNH) de Rafael Lima');
    const selfieImage = await screen.findByAltText('Selfie de Rafael Lima');

    expect(identityImage.parentElement?.parentElement).toHaveClass('ring-primary');
    expect(selfieImage.parentElement?.parentElement).not.toHaveClass('ring-primary');

    await user.keyboard('{ArrowDown}');

    expect(selfieImage.parentElement?.parentElement).toHaveClass('ring-primary');
    expect(identityImage.parentElement?.parentElement).not.toHaveClass('ring-primary');
  });

  it('aprova o documento em destaque com "a" duas vezes (confirma antes de executar)', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    reviewDocumentMock.mockResolvedValue({ id: 'doc-1', status: 'approved' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');

    await user.keyboard('a');
    expect(await screen.findByRole('button', { name: /confirmar aprovação/i })).toBeInTheDocument();
    expect(reviewDocumentMock).not.toHaveBeenCalled();

    await user.keyboard('a');
    await waitFor(() => expect(reviewDocumentMock).toHaveBeenCalledWith('doc-1', 'approved'));
  });

  it('rejeita o documento em destaque com "r" duas vezes, depois de preencher o motivo', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    reviewDocumentMock.mockResolvedValue({ id: 'doc-1', status: 'rejected' });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');

    // Sem motivo, "r" só foca o campo de texto — não arma a confirmação.
    await user.keyboard('r');
    expect(screen.queryByRole('button', { name: /confirmar rejeição/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/motivo da rejeição/i)).toHaveFocus();

    await user.type(screen.getByLabelText(/motivo da rejeição/i), 'Foto não é do documento pedido');
    await user.tab();

    await user.keyboard('r');
    expect(await screen.findByRole('button', { name: /confirmar rejeição/i })).toBeInTheDocument();

    await user.keyboard('r');
    await waitFor(() =>
      expect(reviewDocumentMock).toHaveBeenCalledWith('doc-1', 'rejected', 'Foto não é do documento pedido'),
    );
  });

  it('não deixa rejeitar um documento sem preencher o motivo', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: /^rejeitar$/i }));

    expect(await screen.findByText('Escreva o motivo antes de rejeitar.')).toBeInTheDocument();
    expect(reviewDocumentMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /confirmar rejeição/i })).not.toBeInTheDocument();
  });

  it('cancela a confirmação pendente do atalho de teclado com Esc', async () => {
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [], skillCategories: [] });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');

    await user.keyboard('a');
    await screen.findByRole('button', { name: /confirmar aprovação/i });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: /confirmar aprovação/i })).not.toBeInTheDocument();
    expect(reviewDocumentMock).not.toHaveBeenCalled();
  });

  it('ignora os atalhos de aprovar/rejeitar enquanto o foco está no campo de nome da categoria', async () => {
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [],
      skillCategories: [PENDING_CATEGORY],
    });
    const user = userEvent.setup();

    render(<AdminVerificacoesPage />);
    await screen.findByText('Rafael Lima');

    await user.click(screen.getByLabelText('Nome da categoria'));
    await user.keyboard('a');

    expect(screen.queryByRole('button', { name: /confirmar aprovação/i })).not.toBeInTheDocument();
  });
});
