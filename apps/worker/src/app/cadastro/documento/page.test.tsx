import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import DocumentoPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const uploadWorkerDocumentMock = vi.fn();
const uploadWorkerSelfieMock = vi.fn();
const uploadWorkerCnhDocumentMock = vi.fn();
const uploadWorkerGuardianDocumentMock = vi.fn();
const getWorkerProfileMock = vi.fn();
vi.mock('../../../lib/worker-profile-api', () => ({
  uploadWorkerDocument: (...args: unknown[]) => uploadWorkerDocumentMock(...args),
  uploadWorkerSelfie: (...args: unknown[]) => uploadWorkerSelfieMock(...args),
  uploadWorkerCnhDocument: (...args: unknown[]) => uploadWorkerCnhDocumentMock(...args),
  uploadWorkerGuardianDocument: (...args: unknown[]) => uploadWorkerGuardianDocumentMock(...args),
  getWorkerProfile: (...args: unknown[]) => getWorkerProfileMock(...args),
}));

function createTestPdf(name = 'cnh.pdf'): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function createTestFile(name = 'rg.jpg'): File {
  return new File(['conteúdo'], name, { type: 'image/jpeg' });
}

async function uploadBoth(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), createTestFile('rg.jpg'));
  await user.upload(screen.getByLabelText(/toque para tirar ou escolher uma selfie/i), createTestFile('selfie.jpg'));
}

describe('DocumentoPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    uploadWorkerDocumentMock.mockReset();
    uploadWorkerSelfieMock.mockReset();
    uploadWorkerCnhDocumentMock.mockReset();
    uploadWorkerGuardianDocumentMock.mockReset();
    getWorkerProfileMock.mockReset().mockResolvedValue({
      hasDocument: false,
      hasSelfie: false,
      hasCnhDocument: false,
      cnhCategory: null,
      isMinor: false,
      hasGuardianDocument: false,
    });
  });

  it('começa com o botão desabilitado', () => {
    render(<DocumentoPage />);

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('continua desabilitado só com o documento, sem a selfie', async () => {
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), createTestFile('rg.jpg'));

    expect(screen.getByText('rg.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('habilita o botão depois de escolher documento e selfie', async () => {
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await uploadBoth(user);

    expect(screen.getByText('rg.jpg')).toBeInTheDocument();
    expect(screen.getByText('selfie.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('envia documento e selfie e navega pra /inicio quando dá certo', async () => {
    uploadWorkerDocumentMock.mockResolvedValue({ id: '1', status: 'pending', type: 'identity' });
    uploadWorkerSelfieMock.mockResolvedValue({ id: '2', status: 'pending', type: 'selfie' });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await uploadBoth(user);
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerDocumentMock).toHaveBeenCalledWith(expect.any(File));
    expect(uploadWorkerSelfieMock).toHaveBeenCalledWith(expect.any(File));
  });

  it('mostra a mensagem da API quando o envio falha', async () => {
    uploadWorkerDocumentMock.mockRejectedValue(
      new ApiError(400, 'Envie uma foto em JPEG ou PNG.'),
    );
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await uploadBoth(user);
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('Envie uma foto em JPEG ou PNG.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('não reenvia o documento ao tentar de novo depois que só a selfie falhou', async () => {
    uploadWorkerDocumentMock.mockResolvedValue({ id: '1', status: 'pending', type: 'identity' });
    uploadWorkerSelfieMock
      .mockRejectedValueOnce(new ApiError(500, 'Falha de rede.'))
      .mockResolvedValueOnce({ id: '2', status: 'pending', type: 'selfie' });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await uploadBoth(user);
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    await screen.findByText('Falha de rede.');

    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerDocumentMock).toHaveBeenCalledTimes(1);
    expect(uploadWorkerSelfieMock).toHaveBeenCalledTimes(2);
  });

  it('não reenvia o documento se a tela recarregou depois dele já ter subido', async () => {
    // Estado local zerou (recarregou a página), mas o perfil no servidor
    // já tem o documento — a checagem inicial evita reenviar e duplicar.
    getWorkerProfileMock.mockResolvedValue({ hasDocument: true, hasSelfie: false });
    uploadWorkerSelfieMock.mockResolvedValue({ id: '2', status: 'pending', type: 'selfie' });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await uploadBoth(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerDocumentMock).not.toHaveBeenCalled();
    expect(uploadWorkerSelfieMock).toHaveBeenCalledTimes(1);
  });

  it('não pede a CNH quando o trabalhador não declarou ter uma', async () => {
    render(<DocumentoPage />);

    await waitFor(() => expect(getWorkerProfileMock).toHaveBeenCalled());
    expect(screen.queryByText(/CNH Digital/i)).not.toBeInTheDocument();
  });

  it('exige o PDF da CNH quando o trabalhador declarou ter CNH no cadastro', async () => {
    getWorkerProfileMock.mockResolvedValue({
      hasDocument: false,
      hasSelfie: false,
      hasCnhDocument: false,
      cnhCategory: 'B',
    });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await screen.findByText(/toque para escolher o pdf da cnh digital/i);
    await uploadBoth(user);

    // Documento + selfie escolhidos, mas falta a CNH — continua desabilitado.
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();

    await user.upload(screen.getByLabelText(/toque para escolher o pdf da cnh digital/i), createTestPdf());
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('envia a CNH junto quando exigida, e navega pra /inicio', async () => {
    getWorkerProfileMock.mockResolvedValue({
      hasDocument: false,
      hasSelfie: false,
      hasCnhDocument: false,
      cnhCategory: 'B',
    });
    uploadWorkerDocumentMock.mockResolvedValue({ id: '1', status: 'pending', type: 'identity' });
    uploadWorkerSelfieMock.mockResolvedValue({ id: '2', status: 'pending', type: 'selfie' });
    uploadWorkerCnhDocumentMock.mockResolvedValue({ id: '3', status: 'pending', type: 'cnh' });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await screen.findByText(/toque para escolher o pdf da cnh digital/i);
    await uploadBoth(user);
    await user.upload(screen.getByLabelText(/toque para escolher o pdf da cnh digital/i), createTestPdf());
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerCnhDocumentMock).toHaveBeenCalledWith(expect.any(File));
  });

  it('não reenvia a CNH se ela já tinha sido enviada antes', async () => {
    getWorkerProfileMock.mockResolvedValue({
      hasDocument: true,
      hasSelfie: true,
      hasCnhDocument: true,
      cnhCategory: 'B',
    });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await screen.findByText(/toque para escolher o pdf da cnh digital/i);
    await uploadBoth(user);
    await user.upload(screen.getByLabelText(/toque para escolher o pdf da cnh digital/i), createTestPdf());
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerCnhDocumentMock).not.toHaveBeenCalled();
  });

  it('não pede o documento do responsável quando o trabalhador não é menor de idade', async () => {
    render(<DocumentoPage />);

    await waitFor(() => expect(getWorkerProfileMock).toHaveBeenCalled());
    expect(screen.queryByText(/documento do responsável/i)).not.toBeInTheDocument();
  });

  it('exige o documento do responsável quando o trabalhador é menor de idade', async () => {
    getWorkerProfileMock.mockResolvedValue({
      hasDocument: false,
      hasSelfie: false,
      hasCnhDocument: false,
      cnhCategory: null,
      isMinor: true,
      hasGuardianDocument: false,
    });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await screen.findByText(/toque para escolher o documento do responsável/i);
    await uploadBoth(user);

    // Documento + selfie escolhidos, mas falta o documento do responsável — continua desabilitado.
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();

    await user.upload(screen.getByLabelText(/toque para escolher o documento do responsável/i), createTestFile('rg-pai.jpg'));
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('envia o documento do responsável junto quando exigido, e navega pra /inicio', async () => {
    getWorkerProfileMock.mockResolvedValue({
      hasDocument: false,
      hasSelfie: false,
      hasCnhDocument: false,
      cnhCategory: null,
      isMinor: true,
      hasGuardianDocument: false,
    });
    uploadWorkerDocumentMock.mockResolvedValue({ id: '1', status: 'pending', type: 'identity' });
    uploadWorkerSelfieMock.mockResolvedValue({ id: '2', status: 'pending', type: 'selfie' });
    uploadWorkerGuardianDocumentMock.mockResolvedValue({ id: '4', status: 'pending', type: 'guardian_identity' });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await screen.findByText(/toque para escolher o documento do responsável/i);
    await uploadBoth(user);
    await user.upload(screen.getByLabelText(/toque para escolher o documento do responsável/i), createTestFile('rg-pai.jpg'));
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerGuardianDocumentMock).toHaveBeenCalledWith(expect.any(File));
  });

  it('não reenvia o documento do responsável se ele já tinha sido enviado antes', async () => {
    getWorkerProfileMock.mockResolvedValue({
      hasDocument: true,
      hasSelfie: true,
      hasCnhDocument: false,
      cnhCategory: null,
      isMinor: true,
      hasGuardianDocument: true,
    });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await screen.findByText(/toque para escolher o documento do responsável/i);
    await uploadBoth(user);
    await user.upload(screen.getByLabelText(/toque para escolher o documento do responsável/i), createTestFile('rg-pai.jpg'));
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerGuardianDocumentMock).not.toHaveBeenCalled();
  });
});
