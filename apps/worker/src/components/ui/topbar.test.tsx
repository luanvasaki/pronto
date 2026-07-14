import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Topbar } from './topbar';

const NOTIFICATIONS = [
  { id: 'app-1', message: 'Buffet Aurora aceitou sua candidatura!', href: '/inicio' },
  { id: 'app-2', message: 'Bar do Zé removeu você do turno.', href: '/inicio' },
];

describe('Topbar', () => {
  it('mostra a saudação com o nome do trabalhador perto do sino', () => {
    render(<Topbar calledCount={0} workerName="Ana Souza" />);

    expect(screen.getByText(/, Ana Souza/)).toBeInTheDocument();
  });

  it('mostra o contador de chamadas no sino', () => {
    render(<Topbar calledCount={2} />);

    expect(screen.getByLabelText('2 chamada(s) pra trabalhar')).toBeInTheDocument();
  });

  it('não mostra o dropdown até clicar no sino', () => {
    render(<Topbar calledCount={2} calledNotifications={NOTIFICATIONS} />);

    expect(screen.queryByText(/aceitou sua candidatura/)).not.toBeInTheDocument();
  });

  it('mostra as chamadas ao clicar no sino', async () => {
    const user = userEvent.setup();
    render(<Topbar calledCount={2} calledNotifications={NOTIFICATIONS} />);

    await user.click(screen.getByLabelText('2 chamada(s) pra trabalhar'));

    expect(screen.getByText(/Buffet Aurora aceitou sua candidatura/)).toBeInTheDocument();
    expect(screen.getByText(/Bar do Zé removeu você do turno/)).toBeInTheDocument();
  });

  it('cada notificação leva pro href próprio (ex.: escala esperando avaliação leva pra Agenda)', async () => {
    const user = userEvent.setup();
    render(
      <Topbar
        calledCount={1}
        calledNotifications={[{ id: 'shift-1', message: 'Avalie a Buffet Aurora pela escala de Garçom.', href: '/agenda' }]}
      />,
    );

    await user.click(screen.getByLabelText('1 chamada(s) pra trabalhar'));

    expect(screen.getByRole('link', { name: /avalie a buffet aurora/i })).toHaveAttribute('href', '/agenda');
  });

  it('mostra mensagem de vazio quando não há chamadas', async () => {
    const user = userEvent.setup();
    render(<Topbar calledCount={0} calledNotifications={[]} />);

    await user.click(screen.getByLabelText('Notificações'));

    expect(screen.getByText('Nenhuma novidade por enquanto.')).toBeInTheDocument();
  });

  it('fecha o dropdown ao clicar fora', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Topbar calledCount={2} calledNotifications={NOTIFICATIONS} />
        <p>fora do dropdown</p>
      </div>,
    );

    await user.click(screen.getByLabelText('2 chamada(s) pra trabalhar'));
    expect(screen.getByText(/Buffet Aurora/)).toBeInTheDocument();

    await user.click(screen.getByText('fora do dropdown'));
    expect(screen.queryByText(/Buffet Aurora/)).not.toBeInTheDocument();
  });
});
