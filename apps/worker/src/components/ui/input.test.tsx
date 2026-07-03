import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('associa o label ao campo pelo id', () => {
    render(<Input id="phone" label="Celular" />);

    expect(screen.getByLabelText('Celular')).toBeInTheDocument();
  });

  it('mostra a mensagem de erro e marca aria-invalid', () => {
    render(<Input id="phone" label="Celular" error="Celular inválido" />);

    const input = screen.getByLabelText('Celular');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Celular inválido')).toBeInTheDocument();
  });

  it('não mostra erro nem aria-invalid quando não há erro', () => {
    render(<Input id="phone" label="Celular" />);

    expect(screen.getByLabelText('Celular')).toHaveAttribute('aria-invalid', 'false');
  });
});
