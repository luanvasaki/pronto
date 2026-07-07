import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GanhosPage from './page';

describe('GanhosPage', () => {
  it('mostra a mensagem de em breve', () => {
    render(<GanhosPage />);

    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getByText(/combine o pagamento direto com a empresa/i)).toBeInTheDocument();
  });
});
