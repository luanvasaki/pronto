import { RatingCategory } from '@shift/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RatingForm } from './rating-form';

const CATEGORIES: readonly RatingCategory[] = [
  { id: 'pontualidade_pagamento', label: 'Pontualidade no pagamento' },
  { id: 'respeito', label: 'Respeito no tratamento' },
];

function noop() {}

describe('RatingForm', () => {
  it('mantém o botão desabilitado até avaliar todas as categorias', async () => {
    const user = userEvent.setup();
    const onChangeScore = vi.fn();
    render(
      <RatingForm
        title="Avalie"
        categories={CATEGORIES}
        scores={{}}
        comment=""
        onChangeScore={onChangeScore}
        onChangeComment={noop}
        onSubmit={noop}
        isSubmitting={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Pontualidade no pagamento: 5 de 5' }));
    expect(onChangeScore).toHaveBeenCalledWith('pontualidade_pagamento', 5);
  });

  it('destrava o botão só quando TODAS as categorias têm nota', () => {
    const { rerender } = render(
      <RatingForm
        title="Avalie"
        categories={CATEGORIES}
        scores={{ pontualidade_pagamento: 5 }}
        comment=""
        onChangeScore={noop}
        onChangeComment={noop}
        onSubmit={noop}
        isSubmitting={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeDisabled();

    rerender(
      <RatingForm
        title="Avalie"
        categories={CATEGORIES}
        scores={{ pontualidade_pagamento: 5, respeito: 4 }}
        comment=""
        onChangeScore={noop}
        onChangeComment={noop}
        onSubmit={noop}
        isSubmitting={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeEnabled();
  });

  it('nunca destrava o envio se a lista de categorias vier vazia (evita avaliação com zero notas)', () => {
    render(
      <RatingForm
        title="Avalie"
        categories={[]}
        scores={{}}
        comment=""
        onChangeScore={noop}
        onChangeComment={noop}
        onSubmit={noop}
        isSubmitting={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeDisabled();
  });
});
