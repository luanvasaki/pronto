import { render, screen } from '@testing-library/react';
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
});
