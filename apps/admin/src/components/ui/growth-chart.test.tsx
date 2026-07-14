import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GrowthChart } from './growth-chart';

const DATA = [
  { weekStart: '2026-05-18', count: 1 },
  { weekStart: '2026-05-25', count: 3 },
  { weekStart: '2026-06-01', count: 0 },
  { weekStart: '2026-06-08', count: 5 },
];

describe('GrowthChart', () => {
  it('mostra título, subtítulo e o total do período', () => {
    render(<GrowthChart title="Empresas" subtitle="Novos cadastros por semana" data={DATA} />);

    expect(screen.getByText('Empresas')).toBeInTheDocument();
    expect(screen.getByText('Novos cadastros por semana')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('total no período')).toBeInTheDocument();
  });

  it('mostra o valor e a semana da barra em foco no lugar do total, ao passar o mouse', async () => {
    const user = userEvent.setup();
    render(<GrowthChart title="Empresas" subtitle="Novos cadastros por semana" data={DATA} />);

    const bar = screen.getByRole('button', { name: 'semana de 25/05: 3' });
    await user.hover(bar);

    expect(await screen.findAllByText('25/05')).toHaveLength(2);
    expect(screen.queryByText('total no período')).not.toBeInTheDocument();

    await user.unhover(bar);
    expect(await screen.findByText('total no período')).toBeInTheDocument();
  });

  it('mostra o mesmo detalhe ao focar a barra pelo teclado (paridade com o hover)', async () => {
    render(<GrowthChart title="Empresas" subtitle="Novos cadastros por semana" data={DATA} />);

    const bar = screen.getByRole('button', { name: 'semana de 25/05: 3' });
    bar.focus();

    expect(await screen.findAllByText('25/05')).toHaveLength(2);
  });

  it('rotula a barra mais recente com o valor', () => {
    render(<GrowthChart title="Empresas" subtitle="Novos cadastros por semana" data={DATA} />);

    // A última semana (08/06) tem valor 5, mostrado como rótulo direto na barra.
    const labels = screen.getAllByText('5');
    expect(labels.length).toBeGreaterThan(0);
  });
});
