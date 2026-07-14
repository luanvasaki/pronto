import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('renderiza com o rótulo acessível "Pronto"', () => {
    render(<Logo />);

    expect(screen.getByLabelText('Pronto')).toBeInTheDocument();
  });

  it('usa texto text-background no variant "inverted", pra não sumir em cima de bg-secondary', () => {
    render(<Logo variant="inverted" />);

    const logo = screen.getByLabelText('Pronto');
    expect(logo.querySelector('span.text-background')).not.toBeNull();
    expect(logo.querySelector('span.text-text')).toBeNull();
  });
});
