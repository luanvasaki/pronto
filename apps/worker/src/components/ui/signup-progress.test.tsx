import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SignupProgress } from './signup-progress';

const backMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock }),
}));

describe('SignupProgress', () => {
  it('mostra o passo atual sobre o total padrão de 3', () => {
    render(<SignupProgress step={2} />);

    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument();
  });

  it('aceita um total de passos diferente do padrão', () => {
    render(<SignupProgress step={1} totalSteps={2} />);

    expect(screen.getByText('Passo 1 de 2')).toBeInTheDocument();
  });

  it('chama router.back() ao clicar no botão de voltar', async () => {
    backMock.mockClear();
    const user = userEvent.setup();
    render(<SignupProgress step={2} />);

    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(backMock).toHaveBeenCalledTimes(1);
  });
});
