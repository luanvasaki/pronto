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
const reviewDocumentMock = vi.fn();
const reviewCompanyMock = vi.fn();
const fetchDocumentImageUrlMock = vi.fn();
vi.mock('../../lib/admin-api', () => ({
  listPendingVerifications: (...args: unknown[]) => listPendingVerificationsMock(...args),
  reviewDocument: (...args: unknown[]) => reviewDocumentMock(...args),
  reviewCompany: (...args: unknown[]) => reviewCompanyMock(...args),
  fetchDocumentImageUrl: (...args: unknown[]) => fetchDocumentImageUrlMock(...args),
}));

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

describe('AdminPage', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    listPendingVerificationsMock.mockReset();
    reviewDocumentMock.mockReset();
    reviewCompanyMock.mockReset();
    fetchDocumentImageUrlMock.mockReset().mockResolvedValue('blob:mock-url');
  });

  it('mostra acesso restrito pra quem não é admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: false } });

    render(<AdminPage />);

    expect(await screen.findByText('Essa área é restrita a administradores.')).toBeInTheDocument();
    expect(listPendingVerificationsMock).not.toHaveBeenCalled();
  });

  it('lista documentos e empresas pendentes pro admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({
      documents: [PENDING_DOCUMENT],
      companies: [PENDING_COMPANY],
    });

    render(<AdminPage />);

    expect(await screen.findByText('Rafael Lima')).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé')).toBeInTheDocument();
  });

  it('aprova um documento e remove ele da lista', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    listPendingVerificationsMock.mockResolvedValue({ documents: [PENDING_DOCUMENT], companies: [] });
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
    listPendingVerificationsMock.mockResolvedValue({ documents: [], companies: [PENDING_COMPANY] });
    reviewCompanyMock.mockResolvedValue({ id: 'company-1', verificationStatus: 'rejected' });
    const user = userEvent.setup();

    render(<AdminPage />);
    await screen.findByText('Bar do Zé');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    await waitFor(() => expect(reviewCompanyMock).toHaveBeenCalledWith('company-1', 'rejected'));
    await waitFor(() => expect(screen.queryByText('Bar do Zé')).not.toBeInTheDocument());
  });
});
