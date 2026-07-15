import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallAppBanner } from './install-app-banner';

describe('InstallAppBanner', () => {
  it('não mostra nada por padrão (sem beforeinstallprompt e fora de iOS, ex. jsdom)', () => {
    render(<InstallAppBanner />);

    expect(screen.queryByText('Instale o app Pronto')).not.toBeInTheDocument();
  });
});
