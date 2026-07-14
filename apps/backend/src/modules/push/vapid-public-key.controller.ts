import { Request, Response } from 'express';
import { env } from '../../config/env';

/**
 * Sem auth de propósito — a chave pública VAPID não é segredo (é a
 * própria natureza de uma chave pública), e o navegador precisa dela
 * antes mesmo de decidir se vale a pena pedir permissão de notificação.
 * `publicKey: null` quando o backend não tem VAPID configurado — a tela
 * de notificações do cliente esconde a opção nesse caso.
 */
export function getVapidPublicKeyHandler(_req: Request, res: Response): void {
  res.status(200).json({ publicKey: env.vapidPublicKey ?? null });
}
