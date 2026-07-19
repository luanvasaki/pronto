import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Topbar } from './topbar';

const PENDING_WORKERS = [{ workerId: 'worker-1', workerFullName: 'Ana Souza' }];
const PENDING_COMPANIES = [{ companyId: 'company-1', tradeName: 'Bar do Zé' }];
const PENDING_CATEGORIES = [{ categoryId: 'cat-1', name: 'Barista' }];

describe('Topbar', () => {
  it('mostra a saudação com o nome do admin perto do sino', () => {
    render(<Topbar title="Visão geral" adminName="luan" onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    expect(screen.getByText(/, luan/)).toBeInTheDocument();
  });

  it('mostra o contador de verificações pendentes no sino', () => {
    render(
      <Topbar
        title="Visão geral"
        adminName="luan"
        onMenuClick={vi.fn()}
        onLogout={vi.fn()}
        pendingWorkers={PENDING_WORKERS}
      />,
    );

    expect(screen.getByLabelText('1 verificação(ões) pendente(s)')).toBeInTheDocument();
  });

  it('não mostra o dropdown até clicar no sino', () => {
    render(
      <Topbar
        title="Visão geral"
        adminName="luan"
        onMenuClick={vi.fn()}
        onLogout={vi.fn()}
        pendingWorkers={PENDING_WORKERS}
      />,
    );

    expect(screen.queryByText(/aguardando revisão/)).not.toBeInTheDocument();
  });

  it('mostra trabalhadores, empresas e categorias pendentes ao clicar no sino', async () => {
    const user = userEvent.setup();
    render(
      <Topbar
        title="Visão geral"
        adminName="luan"
        onMenuClick={vi.fn()}
        onLogout={vi.fn()}
        pendingWorkers={PENDING_WORKERS}
        pendingCompanies={PENDING_COMPANIES}
        pendingCategories={PENDING_CATEGORIES}
      />,
    );

    await user.click(screen.getByLabelText('3 verificação(ões) pendente(s)'));

    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
    expect(screen.getByText(/aguardando revisão de/)).toBeInTheDocument();
    expect(screen.getByText(/Bar do Zé/)).toBeInTheDocument();
    expect(screen.getByText(/aguardando verificação/)).toBeInTheDocument();
    expect(screen.getByText(/Barista/)).toBeInTheDocument();
    expect(screen.getByText(/aguardando aprovação/)).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('href', '/admin/verificacoes');
    }
  });

  it('mostra mensagem de vazio quando não há nada pendente', async () => {
    const user = userEvent.setup();
    render(<Topbar title="Visão geral" adminName="luan" onMenuClick={vi.fn()} onLogout={vi.fn()} />);

    await user.click(screen.getByLabelText('Verificações pendentes'));

    expect(screen.getByText('Nenhuma verificação pendente.')).toBeInTheDocument();
  });

  it('fecha o dropdown ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Topbar
          title="Visão geral"
          adminName="luan"
          onMenuClick={vi.fn()}
          onLogout={vi.fn()}
          pendingWorkers={PENDING_WORKERS}
        />
        <p>fora do dropdown</p>
      </div>,
    );

    await user.click(screen.getByLabelText('1 verificação(ões) pendente(s)'));
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();

    await user.click(screen.getByText('fora do dropdown'));
    expect(screen.queryByText(/Ana Souza/)).not.toBeInTheDocument();
  });

  it('chama onLogout ao clicar em Sair', async () => {
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(<Topbar title="Visão geral" adminName="luan" onMenuClick={vi.fn()} onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onLogout).toHaveBeenCalled();
  });
});
