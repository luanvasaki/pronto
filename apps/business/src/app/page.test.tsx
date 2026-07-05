import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home (landing)', () => {
  it('mostra a promessa e um link pra acessar a empresa', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { name: /contrate reforço em minutos/i })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /acessar minha empresa/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/entrar'));
  });
});
