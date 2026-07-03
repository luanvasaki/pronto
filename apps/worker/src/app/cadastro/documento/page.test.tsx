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
vi.mock('../../../lib/worker-profile-api', () => ({
  uploadWorkerDocument: (...args: unknown[]) => uploadWorkerDocumentMock(...args),
}));

function createTestFile(): File {
  return new File(['conteúdo'], 'rg.jpg', { type: 'image/jpeg' });
}

describe('DocumentoPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    uploadWorkerDocumentMock.mockReset();
  });

  it('começa com o botão desabilitado', () => {
    render(<DocumentoPage />);

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('habilita o botão e mostra o nome do arquivo depois de escolher uma foto', async () => {
    const user = userEvent.setup();
    render(<DocumentoPage />);
    const file = createTestFile();

    await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), file);

    expect(screen.getByText('rg.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('envia o documento e navega pra /inicio quando dá certo', async () => {
    uploadWorkerDocumentMock.mockResolvedValue({ id: '1', status: 'pending' });
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), createTestFile());
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
    expect(uploadWorkerDocumentMock).toHaveBeenCalledWith(expect.any(File));
  });

  it('mostra a mensagem da API quando o envio falha', async () => {
    uploadWorkerDocumentMock.mockRejectedValue(
      new ApiError(400, 'Envie uma foto em JPEG ou PNG.'),
    );
    const user = userEvent.setup();
    render(<DocumentoPage />);

    await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), createTestFile());
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('Envie uma foto em JPEG ou PNG.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
