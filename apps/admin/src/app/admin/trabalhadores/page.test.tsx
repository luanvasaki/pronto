import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminTrabalhadoresPage from './page';

const listAdminWorkersMock = vi.fn();
const resetUserPasswordMock = vi.fn();
vi.mock('../../../lib/admin-api', () => ({
  listAdminWorkers: (...args: unknown[]) => listAdminWorkersMock(...args),
  resetUserPassword: (...args: unknown[]) => resetUserPasswordMock(...args),
}));

const WORKER = {
  userId: 'worker-1',
  fullName: 'Rafael Lima',
  email: 'rafael@example.com',
  phone: '11912345678',
  photoUrl: '/uploads/public/rafael.jpg',
  kycStatus: 'approved',
  avgRating: '4.8',
  shiftsCompleted: 5,
  hoursWorked: 20,
  createdAt: '2026-07-01T12:00:00.000Z',
};

describe('AdminTrabalhadoresPage', () => {
  beforeEach(() => {
    listAdminWorkersMock.mockReset();
    resetUserPasswordMock.mockReset();
  });

  it('mostra a foto de perfil do trabalhador', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [WORKER] });

    render(<AdminTrabalhadoresPage />);

    const photo = await screen.findByAltText('Rafael Lima');
    expect(photo).toHaveAttribute('src', '/uploads/public/rafael.jpg');
  });

  it('mostra iniciais quando o trabalhador não tem foto', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [{ ...WORKER, photoUrl: null }] });

    render(<AdminTrabalhadoresPage />);

    await screen.findByText('Rafael Lima');
    expect(screen.queryByAltText('Rafael Lima')).not.toBeInTheDocument();
  });

  it('mostra o telefone formatado como link pra ligar', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [WORKER] });

    render(<AdminTrabalhadoresPage />);

    const link = await screen.findByRole('link', { name: '(11) 91234-5678' });
    expect(link).toHaveAttribute('href', 'tel:+5511912345678');
  });

  it('não mostra link de telefone quando o trabalhador não informou', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [{ ...WORKER, phone: null }] });

    render(<AdminTrabalhadoresPage />);

    await screen.findByText('Rafael Lima');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('pede confirmação antes de resetar a senha, e só chama a API no segundo clique', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [WORKER] });
    resetUserPasswordMock.mockResolvedValue({ email: 'rafael@example.com' });
    const user = userEvent.setup();

    render(<AdminTrabalhadoresPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: 'Resetar senha' }));

    expect(resetUserPasswordMock).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Confirmar envio' }));

    expect(resetUserPasswordMock).toHaveBeenCalledWith('worker-1');
    expect(await screen.findByText('Link de redefinição enviado pra rafael@example.com.')).toBeInTheDocument();
  });

  it('cancela a confirmação de resetar senha sem chamar a API', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [WORKER] });
    const user = userEvent.setup();

    render(<AdminTrabalhadoresPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: 'Resetar senha' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('button', { name: 'Confirmar envio' })).not.toBeInTheDocument();
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it('mostra erro quando resetar a senha falha', async () => {
    listAdminWorkersMock.mockResolvedValue({ workers: [WORKER] });
    resetUserPasswordMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<AdminTrabalhadoresPage />);
    await screen.findByText('Rafael Lima');
    await user.click(screen.getByRole('button', { name: 'Resetar senha' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar envio' }));

    expect(await screen.findByText('Não foi possível enviar o link.')).toBeInTheDocument();
  });
});
