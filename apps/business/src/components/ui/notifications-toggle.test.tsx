import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotificationsToggle } from './notifications-toggle';

describe('NotificationsToggle', () => {
  it('mostra aviso de suporte quando o navegador não tem Notification/PushManager (ex. jsdom)', async () => {
    render(<NotificationsToggle />);

    expect(await screen.findByText('Seu navegador não suporta notificações push.')).toBeInTheDocument();
  });
});
