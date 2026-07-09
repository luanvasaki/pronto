import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Topbar } from './topbar';

const NOTIFICATIONS = [
  { applicationId: 'app-1', jobId: 'job-1', workerName: 'Ana Souza', categoryName: 'Garçom' },
  { applicationId: 'app-2', jobId: 'job-2', workerName: 'Beatriz Lima', categoryName: 'Cozinha' },
];

describe('Topbar', () => {
  it('mostra o contador de candidaturas pendentes no sino', () => {
    render(<Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} />);

    expect(screen.getByLabelText('2 candidatura(s) aguardando resposta')).toBeInTheDocument();
  });

  it('não mostra o dropdown até clicar no sino', () => {
    render(
      <Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} pendingApplications={NOTIFICATIONS} />,
    );

    expect(screen.queryByText(/se inscreveu na vaga/)).not.toBeInTheDocument();
  });

  it('mostra as candidaturas ao clicar no sino', async () => {
    const user = userEvent.setup();
    render(
      <Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} pendingApplications={NOTIFICATIONS} />,
    );

    await user.click(screen.getByLabelText('2 candidatura(s) aguardando resposta'));

    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
    expect(screen.getAllByText(/se inscreveu na vaga de/)).toHaveLength(2);
    expect(screen.getByText(/Beatriz Lima/)).toBeInTheDocument();
  });

  it('mostra mensagem de vazio quando não há candidaturas pendentes', async () => {
    const user = userEvent.setup();
    render(<Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={0} pendingApplications={[]} />);

    await user.click(screen.getByLabelText('Notificações'));

    expect(screen.getByText('Nenhuma candidatura aguardando resposta.')).toBeInTheDocument();
  });

  it('fecha o dropdown ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} pendingApplications={NOTIFICATIONS} />
        <p>fora do dropdown</p>
      </div>,
    );

    await user.click(screen.getByLabelText('2 candidatura(s) aguardando resposta'));
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();

    await user.click(screen.getByText('fora do dropdown'));
    expect(screen.queryByText(/Ana Souza/)).not.toBeInTheDocument();
  });
});
