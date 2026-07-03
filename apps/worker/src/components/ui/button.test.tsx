import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('chama onClick quando clicado', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Continuar</Button>);

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('fica desabilitado durante isLoading e mostra o spinner', () => {
    render(<Button isLoading>Enviando</Button>);

    const button = screen.getByRole('button', { name: /enviando/i });
    expect(button).toBeDisabled();
  });

  it('respeita disabled explícito', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Continuar
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
