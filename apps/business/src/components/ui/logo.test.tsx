import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  it('renderiza com o rótulo acessível "Pronto"', () => {
    render(<Logo />);

    expect(screen.getByLabelText('Pronto')).toBeInTheDocument();
  });
});
