import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('mostra label e valor no tamanho padrão', () => {
    render(<StatCard label="Empresas cadastradas" value="42" />);

    expect(screen.getByText('Empresas cadastradas')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('mostra a dica quando informada', () => {
    render(<StatCard label="Escalas abertas" value="3" hint="2 candidato(s) aguardando" />);

    expect(screen.getByText('2 candidato(s) aguardando')).toBeInTheDocument();
  });

  it('não mostra dica quando não informada', () => {
    render(<StatCard label="Empresas cadastradas" value="42" />);

    expect(screen.queryByText(/aguardando/i)).not.toBeInTheDocument();
  });

  it('renderiza no tamanho compacto usado na visão geral do admin', () => {
    const { container } = render(<StatCard size="compact" label="Vagas publicadas" value="10" />);

    expect(screen.getByText('Vagas publicadas')).toBeInTheDocument();
    expect(container.querySelector('.text-center')).toBeInTheDocument();
  });
});
