import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';

/** Último middleware da cadeia: se chegou aqui, nenhuma rota tratou o pedido. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`));
}
