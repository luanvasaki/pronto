import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Topbar } from './topbar';

const NOTIFICATIONS = [
  { applicationId: 'app-1', companyName: 'Buffet Aurora' },
  { applicationId: 'app-2', companyName: 'Bar do Zé' },
];

describe('Topbar', () => {
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

    expect(screen.getByText(/Buffet Aurora/)).toBeInTheDocument();
    expect(screen.getAllByText(/aceitou sua candidatura/)).toHaveLength(2);
    expect(screen.getByText(/Bar do Zé/)).toBeInTheDocument();
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
