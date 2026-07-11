import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Topbar } from './topbar';

const NOTIFICATIONS = [
  { applicationId: 'app-1', jobId: 'job-1', workerName: 'Ana Souza', categoryName: 'Garçom' },
  { applicationId: 'app-2', jobId: 'job-2', workerName: 'Beatriz Lima', categoryName: 'Cozinha' },
];

const CHECKED_IN_NOTIFICATIONS = [
  { shiftId: 'shift-1', jobId: 'job-1', workerName: 'Carlos Souza', categoryName: 'Garçom', checkInAt: '2026-07-10T18:57:00.000Z' },
];

const PENDING_RATINGS_NOTIFICATIONS = [
  { shiftId: 'shift-2', jobId: 'job-2', workerName: 'Diego Alves', categoryName: 'Cozinha', checkOutAt: '2026-07-10T22:00:00.000Z' },
];

describe('Topbar', () => {
  it('não esconde o sino em telas pequenas (sem classe "hidden" no container)', () => {
    render(<Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={0} />);

    const bellButton = screen.getByLabelText('Notificações');
    const bellContainer = bellButton.parentElement;

    expect(bellContainer?.className ?? '').not.toMatch(/\bhidden\b/);
  });

  it('mostra o contador de notificações pendentes no sino', () => {
    render(<Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} />);

    expect(screen.getByLabelText('2 notificação(ões) pendente(s)')).toBeInTheDocument();
  });

  it('soma candidaturas pendentes e check-ins não vistos no contador', () => {
    render(<Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} checkedInCount={1} />);

    expect(screen.getByLabelText('3 notificação(ões) pendente(s)')).toBeInTheDocument();
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

    await user.click(screen.getByLabelText('2 notificação(ões) pendente(s)'));

    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
    expect(screen.getAllByText(/se inscreveu na vaga de/)).toHaveLength(2);
    expect(screen.getByText(/Beatriz Lima/)).toBeInTheDocument();
  });

  it('mostra check-ins não vistos junto das candidaturas, e chama onOpenNotifications ao abrir', async () => {
    const onOpenNotifications = vi.fn();
    const user = userEvent.setup();
    render(
      <Topbar
        title="Painel"
        onMenuClick={vi.fn()}
        pendingApplicationsCount={0}
        checkedInCount={1}
        checkedInNotifications={CHECKED_IN_NOTIFICATIONS}
        onOpenNotifications={onOpenNotifications}
      />,
    );

    await user.click(screen.getByLabelText('1 notificação(ões) pendente(s)'));

    expect(screen.getByText(/Carlos Souza/)).toBeInTheDocument();
    expect(screen.getByText(/fez check-in às/)).toBeInTheDocument();
    expect(onOpenNotifications).toHaveBeenCalled();
  });

  it('soma avaliações pendentes no contador, e mostra o aviso ao clicar no sino', async () => {
    const user = userEvent.setup();
    render(
      <Topbar
        title="Painel"
        onMenuClick={vi.fn()}
        pendingApplicationsCount={0}
        pendingRatingsCount={1}
        pendingRatingsNotifications={PENDING_RATINGS_NOTIFICATIONS}
      />,
    );

    expect(screen.getByLabelText('1 notificação(ões) pendente(s)')).toBeInTheDocument();

    await user.click(screen.getByLabelText('1 notificação(ões) pendente(s)'));

    expect(screen.getByText(/Diego Alves/)).toBeInTheDocument();
    expect(screen.getByText(/Avalie/)).toBeInTheDocument();
    expect(screen.getByText(/pela escala de/)).toBeInTheDocument();
  });

  it('não chama onOpenNotifications quando não há check-in não visto', async () => {
    const onOpenNotifications = vi.fn();
    const user = userEvent.setup();
    render(
      <Topbar
        title="Painel"
        onMenuClick={vi.fn()}
        pendingApplicationsCount={1}
        pendingApplications={[NOTIFICATIONS[0]]}
        onOpenNotifications={onOpenNotifications}
      />,
    );

    await user.click(screen.getByLabelText('1 notificação(ões) pendente(s)'));

    expect(onOpenNotifications).not.toHaveBeenCalled();
  });

  it('mostra mensagem de vazio quando não há nenhuma notificação', async () => {
    const user = userEvent.setup();
    render(<Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={0} pendingApplications={[]} />);

    await user.click(screen.getByLabelText('Notificações'));

    expect(screen.getByText('Nenhuma notificação por aqui.')).toBeInTheDocument();
  });

  it('fecha o dropdown ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Topbar title="Painel" onMenuClick={vi.fn()} pendingApplicationsCount={2} pendingApplications={NOTIFICATIONS} />
        <p>fora do dropdown</p>
      </div>,
    );

    await user.click(screen.getByLabelText('2 notificação(ões) pendente(s)'));
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();

    await user.click(screen.getByText('fora do dropdown'));
    expect(screen.queryByText(/Ana Souza/)).not.toBeInTheDocument();
  });
});
