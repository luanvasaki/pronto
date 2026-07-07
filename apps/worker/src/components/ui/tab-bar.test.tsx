import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from './tab-bar';

const usePathnameMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('TabBar', () => {
  it('renderiza os 4 links de navegação', () => {
    usePathnameMock.mockReturnValue('/inicio');
    render(<TabBar />);

    expect(screen.getByRole('link', { name: 'Turnos' })).toHaveAttribute('href', '/inicio');
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda');
    expect(screen.getByRole('link', { name: 'Ganhos' })).toHaveAttribute('href', '/ganhos');
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/perfil');
  });

  it('marca a aba atual com aria-current', () => {
    usePathnameMock.mockReturnValue('/agenda');
    render(<TabBar />);

    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Turnos' })).not.toHaveAttribute('aria-current');
  });
});
