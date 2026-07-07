import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from './layout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/inicio',
}));

const getCurrentUserMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  };
});

describe('AppLayout', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
  });

  it('mostra confirmando sessão em vez do conteúdo enquanto checa', () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    expect(screen.getByText(/confirmando sua sessão/i)).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('mostra o conteúdo e a tab bar quando a sessão é válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    render(
      <AppLayout>
        <p>Conteúdo protegido</p>
      </AppLayout>,
    );

    expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
  });
});
