import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminOverviewPage from './page';

const getAdminMetricsMock = vi.fn();
const getAdminGrowthMetricsMock = vi.fn();
const deleteDemoDataMock = vi.fn();
vi.mock('../../lib/admin-api', () => ({
  getAdminMetrics: (...args: unknown[]) => getAdminMetricsMock(...args),
  getAdminGrowthMetrics: (...args: unknown[]) => getAdminGrowthMetricsMock(...args),
  deleteDemoData: (...args: unknown[]) => deleteDemoDataMock(...args),
}));

const SAMPLE_METRICS = {
  payments: { totalProcessed: '1500.00', countByStatus: { pending: 2, charged: 3, released: 5, failed: 0, refunded: 0 } },
  workers: { total: 10, verified: 7, active: 4 },
  companies: { total: 3, verified: 2, jobsPosted: 8 },
  shifts: { completed: 6, cancelled: 1, noShow: 0 },
};

const SAMPLE_WEEK = { weekStart: '2026-06-29', count: 2 };
const SAMPLE_GROWTH = {
  companies: [SAMPLE_WEEK],
  workers: [SAMPLE_WEEK],
  dealsClosed: [SAMPLE_WEEK],
};

describe('AdminOverviewPage', () => {
  beforeEach(() => {
    getAdminMetricsMock.mockReset().mockResolvedValue(SAMPLE_METRICS);
    getAdminGrowthMetricsMock.mockReset().mockResolvedValue(SAMPLE_GROWTH);
    deleteDemoDataMock.mockReset();
  });

  it('mostra as métricas gerais', async () => {
    render(<AdminOverviewPage />);

    expect(await screen.findByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('mostra os gráficos de crescimento', async () => {
    render(<AdminOverviewPage />);

    expect(await screen.findByText('Empresas')).toBeInTheDocument();
    expect(screen.getByText('Trabalhadores')).toBeInTheDocument();
    expect(screen.getByText('Negociações fechadas')).toBeInTheDocument();
  });

  it('pede confirmação antes de remover os dados de demonstração', async () => {
    const user = userEvent.setup();

    render(<AdminOverviewPage />);
    await screen.findByText('Dados de demonstração');
    await user.click(screen.getByRole('button', { name: /remover dados de demonstração/i }));

    expect(screen.getByRole('button', { name: /confirmar remoção/i })).toBeInTheDocument();
    expect(deleteDemoDataMock).not.toHaveBeenCalled();
  });

  it('remove os dados de demonstração depois de confirmar', async () => {
    deleteDemoDataMock.mockResolvedValue({ companiesRemoved: 3 });
    const user = userEvent.setup();

    render(<AdminOverviewPage />);
    await screen.findByText('Dados de demonstração');
    await user.click(screen.getByRole('button', { name: /remover dados de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /confirmar remoção/i }));

    expect(deleteDemoDataMock).toHaveBeenCalled();
    expect(await screen.findByText('3 empresa(s) de demonstração removida(s).')).toBeInTheDocument();
  });

  it('cancela sem chamar a API', async () => {
    const user = userEvent.setup();

    render(<AdminOverviewPage />);
    await screen.findByText('Dados de demonstração');
    await user.click(screen.getByRole('button', { name: /remover dados de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByRole('button', { name: /remover dados de demonstração/i })).toBeInTheDocument();
    expect(deleteDemoDataMock).not.toHaveBeenCalled();
  });
});
