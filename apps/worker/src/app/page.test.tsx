import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home (onboarding)', () => {
  it('mostra a promessa e um link pra entrar', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: /renda extra quando você quiser/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /criar conta grátis/i })).toHaveAttribute(
      'href',
      '/entrar',
    );
  });
});
