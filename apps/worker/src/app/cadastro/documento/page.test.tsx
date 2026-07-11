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
vi.mock('../../../lib/worker-profile-api', () => ({
  uploadWorkerDocument: (...args: unknown[]) => uploadWorkerDocumentMock(...args),
  uploadWorkerSelfie: (...args: unknown[]) => uploadWorkerSelfieMock(...args),
}));

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
});
