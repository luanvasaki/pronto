import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ZoomableDocumentImage } from './zoomable-document-image';

describe('ZoomableDocumentImage', () => {
  it('mostra a miniatura e não abre o lightbox antes do clique', () => {
    render(<ZoomableDocumentImage src="blob:documento-1" alt="RG de Ana Souza" />);

    expect(screen.getByAltText('RG de Ana Souza')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre o lightbox em tamanho maior ao clicar na miniatura', async () => {
    const user = userEvent.setup();
    render(<ZoomableDocumentImage src="blob:documento-1" alt="RG de Ana Souza" />);

    await user.click(screen.getByRole('button', { name: 'Ampliar RG de Ana Souza' }));

    const dialog = screen.getByRole('dialog', { name: 'RG de Ana Souza' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByAltText('RG de Ana Souza')).toHaveLength(2);
  });

  it('fecha o lightbox pelo botão de fechar', async () => {
    const user = userEvent.setup();
    render(<ZoomableDocumentImage src="blob:documento-1" alt="RG de Ana Souza" />);

    await user.click(screen.getByRole('button', { name: 'Ampliar RG de Ana Souza' }));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha o lightbox com a tecla Esc', async () => {
    const user = userEvent.setup();
    render(<ZoomableDocumentImage src="blob:documento-1" alt="RG de Ana Souza" />);

    await user.click(screen.getByRole('button', { name: 'Ampliar RG de Ana Souza' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('alterna entre ajustar à tela e tamanho real ao clicar na imagem ampliada', async () => {
    const user = userEvent.setup();
    render(<ZoomableDocumentImage src="blob:documento-1" alt="RG de Ana Souza" />);

    await user.click(screen.getByRole('button', { name: 'Ampliar RG de Ana Souza' }));
    expect(screen.getByText(/ver em tamanho real/i)).toBeInTheDocument();

    const enlargedImage = screen.getAllByAltText('RG de Ana Souza')[1];
    await user.click(enlargedImage);

    expect(screen.getByText(/ajustar à tela/i)).toBeInTheDocument();
  });
});
