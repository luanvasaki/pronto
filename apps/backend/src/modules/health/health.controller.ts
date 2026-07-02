import { Request, Response } from 'express';

/** Confirma que o processo está de pé — usado por load balancer e monitoramento. */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
